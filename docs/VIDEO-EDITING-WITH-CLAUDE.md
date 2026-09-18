# Video Editing With Claude — Operator's Playbook

**Give this file to Claude. It will read it, check what it actually has, fix what
it can, ask you for what it can't, and then edit video from your spoken
direction.**

You do not need to know ffmpeg. You dictate the style; Claude builds it.

---

## 0. What this is, and the one idea behind it

This is a working playbook for producing short-form video (TikTok / Reels /
Shorts) by **writing the compositor in code** rather than clicking around a GUI
editor.

That choice is not ideology, it is arithmetic. Driving Premiere, DaVinci,
Kdenlive or Photopea through a remote desktop means an agent clicking at
coordinates it cannot see well, one action at a time. Rendering frames from
code means every frame is computed, deterministic, reproducible, and exact to
the millisecond. It is also what After Effects does internally.

The output is a normal `.mp4`. If you want to hand-tune it afterwards in a real
editor, nothing stops you.

**Claude: read sections 1 and 2 before doing anything else.**

---

## 1. PREFLIGHT — run this before promising anything

Claude, run these checks and report the results as a short table. Do not skip
this and do not assume. Several of these fail silently in fresh containers.

### 1.1 Capability probe

```bash
# Shell, and what is on it
uname -a; nproc; free -g | head -2; df -h / | tail -1

# The four things that actually matter
which ffmpeg ffprobe && ffmpeg -version | head -1
which node && node --version
which python3 && python3 --version
which convert identify montage && convert --version | head -1   # ImageMagick

# Headless browser (the renderer runs here)
ls /opt/pw-browsers/*/chrome-linux/chrome 2>/dev/null
node -e "require('playwright-core'); console.log('playwright-core ok')" 2>/dev/null

# Text-to-speech
which piper && python3 -c "import numpy" 2>&1 | tail -1

# Fonts — this one lies. See 1.4.
fc-match "Impact"; fc-match "Anton"
```

### 1.2 Decision table

| Probe result | What it means | What Claude does |
|---|---|---|
| No shell at all | You are in a chat-only surface | **Stop.** Tell the user this playbook needs a machine. Point them at section 1.5. |
| Shell, no ffmpeg | Fixable | `apt-get install -y ffmpeg` (ask first if the environment is shared) |
| Shell + ffmpeg, no Chromium | Renderer unavailable | Fall back to the **ffmpeg-only** subset (section 11, marked ⚙). Say plainly which styles are then off the table. |
| Chromium present, `playwright-core` missing | Fixable | `npm i playwright-core` in a scratch dir. Never run `playwright install` — the browser is already there, point `executablePath` at it. |
| `piper` present, `import numpy` fails | **Common.** Piper is installed but its numpy is broken | Apply the repair in section 5.2. Do not give up on Piper. |
| `fc-match Impact` returns DejaVu / Liberation / Nimbus | **The font is not installed.** fontconfig substitutes silently | Install real display fonts, section 4.3. This is why text looks cheap. |
| Rezona MCP tools absent | Generative assets unavailable | Section 1.3 |
| Shell works but the job needs a screen | No desktop | **Bring one up yourself** and send a screenshot — section 1.4. Do not ask first |

### 1.3 Rezona Lab — check, then connect

Rezona Lab gives you generated **voice, music, sound effects, images, sprites
and 3D models**. It is both an MCP server *and* a local CLI. You do not need
an MCP connector to use it — the CLI is enough, and in a headless container
the CLI is easier.

**Check first:**

```bash
# Is it already wired as MCP?  (tool names look like rezona / mcp__rezona__*)
# If your client lists them, use them and skip the rest of this section.

# Otherwise, use the CLI:
mkdir -p ~/rz && cd ~/rz && npm i rezona@latest --silent
node node_modules/rezona/dist/cli/index.js status
```

`status` prints the credential, endpoint, project count and **credit balance**.
If it errors, you are not authenticated.

**To authenticate without ever putting a key in the chat:**

```bash
node node_modules/rezona/dist/cli/index.js login --no-browser
```

It prints a URL of the form `https://rezona.ai/api-keys?code=XXXX-XXXX-XXXX-XXXX`
and a matching confirmation code, then waits.

> **Claude: give the user that URL and the code, and tell them to approve it in
> their own browser.** This is a one-time pairing the user approves while
> already logged in. The credential is written to disk on the machine and
> never passes through the conversation. **Do not ask the user to paste an API
> key into chat** — anything pasted into a conversation is in the transcript
> forever and has to be rotated afterwards. If the user pastes one anyway, use
> it, but tell them once, plainly, to rotate it when the job is done.

The pairing window is finite. If it expires, just run the command again.

**Calling the MCP server from a plain shell** (useful when the CLI is available
but the MCP connector is not):

```bash
cat > rz.sh <<'EOF'
#!/bin/bash
cd "$(dirname "$0")"
T="$1"; A="${2:-{\}}"
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cc","version":"1"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 "$(python3 -c "import json,sys; print(json.dumps({'jsonrpc':'2.0','id':2,'method':'tools/call','params':{'name':sys.argv[1],'arguments':json.loads(sys.argv[2])}}))" "$T" "$A")" \
 | timeout 180 node node_modules/rezona/dist/cli/index.js mcp 2>/dev/null \
 | python3 -c "
import json,sys
for l in sys.stdin:
    try: d=json.loads(l)
    except: continue
    if d.get('id')==2:
        for c in d.get('result',{}).get('content',[]):
            if c.get('type')=='text': print(c['text'])
"
EOF
chmod +x rz.sh
./rz.sh list_projects '{}'
```

Tools: `create_project`, `list_projects`, `submit_image_generation`,
`submit_video_generation`, `submit_audio_generation`, `submit_model3d_generation`,
`submit_sprite_generation`, `check_generation_tasks`, `fetch_generated_asset`,
`upload_project`, `publish_to_rezona_app`.

All `submit_*` calls are **asynchronous**: they return a `task_id` immediately,
you poll `check_generation_tasks`, then download. `fetch_generated_asset` refuses
to write outside a directory containing a `.rezona/` marker — the simplest path
is to skip it and `curl` the `public_url` that `check_generation_tasks` returns.

**Measured behaviour you must design around** (observed over ~120 calls; verify
it still holds before relying on it):

| Call | What happens | Work around it by |
|---|---|---|
| `kind: "speech"` | **Frequently returns ~30–45 s of music instead of the line.** Hit rate was ~20% early, degrading to ~3% under load. `duration` is a hint, not a contract | **Do not use it for narration.** Use Piper (section 5). If you must: submit N copies and auto-reject by waveform shape (5.4) |
| `kind: "sound"` | Reliable. Minimum duration **1.0 s** — shorter requests fail validation | Request 1.0 s and trim locally |
| `kind: "music"` | Reliable, but caps around **10 s** no matter what you request | Generate 6–8 pieces and crossfade-chain them (section 8.3) |
| `submit_image_generation` | Reliable and good. `transparent: true` works | Prompt text sometimes leaks into the image — crop or regenerate |
| Any burst | `GENERATION_RATE_LIMITED` after a few rapid calls | Pace ≥3 s between submits; **read the error** and back off exponentially. A retry loop that ignores the error burns its whole budget against a closed window |
| Transient | `生成服务暂时不可用` = service temporarily unavailable | Retry later; it recovers |

### 1.4 No usable machine? Bring one up. Then screenshot it.

**Standing instruction: if the preflight finds no usable machine, do not stop
and do not ask. Bring up a desktop, take a screenshot, and send it.** Report
what you did afterwards, not before.

"No usable machine" means any of:

- a shell exists but the task needs a graphical app (an editor, a design tool,
  something you have to look at);
- the shell is missing tools you cannot install headlessly;
- you have a shell but no way to *see* anything, and the job needs eyes.

It does **not** mean "no shell at all" — with no shell you cannot start a
container either. That case is 1.5.

#### Ladder — try in this order, stop at the first that works

**Rung 1 — headless X in the machine you already have.** Fastest, no Docker,
no ports, ~1 GB.

```bash
apt-get install -y xvfb x11-utils imagemagick xfce4 xfce4-terminal
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
startxfce4 &
sleep 5
import -window root /tmp/desktop.png      # ← screenshot, send this
```

Good enough whenever only *you* need to see the screen.

**Rung 2 — neko, a shared desktop in Docker over WebRTC.** Use this when a
**human** has to watch or take over, or when rung 1 is unavailable.
`m1k1o/neko` streams a browser *or* a full XFCE/KDE desktop to a web page
several people can control at once. Docs: <https://neko.m1k1o.net/>,
images: `ghcr.io/m1k1o/neko/*`.

Check the prerequisites, then go:

```bash
docker info >/dev/null 2>&1 && echo "docker ok" || echo "NO DOCKER — go to rung 3"
IP=$(curl -s --max-time 10 ifconfig.me || hostname -I | awk '{print $1}')
echo "host ip: $IP"
```

```bash
mkdir -p ~/neko && cd ~/neko
cat > docker-compose.yml <<EOF
services:
  neko:
    image: "ghcr.io/m1k1o/neko/xfce:latest"     # full desktop, not just a browser
    restart: unless-stopped
    shm_size: "2gb"
    ports:
      - "8080:8080"
      - "52000-52100:52000-52100/udp"
    environment:
      NEKO_DESKTOP_SCREEN: 1920x1080@30
      NEKO_MEMBER_MULTIUSER_USER_PASSWORD: neko
      NEKO_MEMBER_MULTIUSER_ADMIN_PASSWORD: admin
      NEKO_WEBRTC_EPR: 52000-52100
      NEKO_WEBRTC_NAT1TO1: $IP
EOF
docker compose up -d
sleep 20
docker compose ps
curl -sS -o /dev/null -w "neko http %{http_code}\n" http://localhost:8080/
```

Then **hand the user the door**, in one message:

```
Desktop is up:  http://<host-ip>:8080/
  viewer  → neko
  admin   → admin
```

Use `ghcr.io/m1k1o/neko/chromium:latest` instead if a browser alone is enough —
it is much lighter than the XFCE image.

**Screenshot a running neko** (it has a real X server inside the container):

```bash
docker compose exec -T neko sh -c 'DISPLAY=:99 import -window root /tmp/s.png' \
  && docker compose cp neko:/tmp/s.png ./neko.png
# if `import` is missing inside the image:
docker compose exec -T neko sh -c 'apt-get update -qq && apt-get install -y -qq imagemagick'
```

**Rung 3 — no Docker, or ports blocked.** Do not flail. Say which prerequisite
failed, in one line, and offer the alternatives in 1.5. Possible saves before
giving up:

- `NEKO_WEBRTC_NAT1TO1` wrong → the page loads but the stream never starts. Set
  it to the address the *user's browser* will reach, not the container's.
- UDP 52000-52100 blocked → try `NEKO_WEBRTC_UDPMUX: 52100` (one UDP port) or
  `NEKO_WEBRTC_TCPMUX: 8081` (TCP only, worse quality, gets through most
  firewalls).
- Port 8080 taken → move the left-hand side: `"9080:8080"`.
- Rootless/no-privileges host → rung 1 instead; Xvfb needs nothing special.

#### Screenshots are not optional

**Send a screenshot whenever the user cannot see what you can.** Do not
describe a screen in prose when you can show it.

Send one:

- as soon as any desktop comes up (proof it works, and it is the fastest way
  for the user to spot that it came up wrong);
- before and after anything done inside a GUI app;
- at each checkpoint of a long job;
- with every video deliverable — a contact sheet (section 10), always;
- whenever you are about to say "it looks right".

```bash
# a desktop you own
DISPLAY=:99 import -window root /tmp/shot.png

# just one window
DISPLAY=:99 import -window "$(DISPLAY=:99 xdotool getactivewindow)" /tmp/win.png

# a web page, no desktop needed
node -e "const{chromium}=require('playwright-core');(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME,args:['--no-sandbox']});
  const p=await b.newPage({viewport:{width:1440,height:900}});
  await p.goto(process.argv[1],{waitUntil:'networkidle'});
  await p.screenshot({path:'/tmp/page.png',fullPage:true}); await b.close();})()" "https://example.com"

# several moments of a video in one image
ffmpeg -v error -i out.mp4 -vf "fps=1/2.5,scale=176:-1,tile=9x3" -frames:v 1 sheet.jpg -y
```

Then attach the file with whatever mechanism the surface gives you, and say in
one line what the user should be looking at. Downscale before sending —
1920×1080 PNG screenshots are large, and `-resize 50%` costs nothing in
legibility.

**Rung 4 — the user already has a VM/VPS.** If they mention one, prefer it over
starting containers: ask for SSH, or ask them to run the preflight there and
paste the output back.

### 1.5 If there is genuinely no shell

With no shell you cannot start Docker, so there is nothing to bring up. Say so
in one sentence instead of pretending, and give the user the shortest path to a
machine — best first:

1. **Claude Code on the web / desktop** — a container with shell, ffmpeg and
   Chromium. This is what the playbook assumes.
2. **Any Linux box + SSH** — a €5 VPS handles 1080×1920 at 30 fps.
3. **A local machine with Docker** — hand them the neko compose file above;
   it is copy-paste, and then they give you the URL.
4. **Browser-only editors** (CapCut Web, Kdenlive via RollApp, Photopea) — the
   *user* drives those by hand. You can still deliver the shot list, script,
   timing sheet, subtitle file (`.srt`/`.ass`) and every generated asset, ready
   to drop in.

---

## 2. The pipeline

Seven stages. Each produces a file the next one reads, so any stage can be
re-run alone.

```
  source footage ─┐
                  ├─► 1. ANALYSE      → clean-window map, level/scene labels
  script text ────┤
                  ├─► 2. VOICE        → one .mp3 per line (Piper)
                  ├─► 3. TIME         → word-level timings from the waveform
                  ├─► 4. ASSETS       → stickers, logos, memes, SFX, music
                  ├─► 5. TIMELINE     → guion.json  (the single source of truth)
                  ├─► 6. RENDER       → PNG frame sequence (headless canvas)
                  └─► 7. MIX+ENCODE   → final .mp4
```

**`guion.json` is the contract.** Everything downstream reads it. Its shape:

```jsonc
{
  "fps": 30,
  "dur": 56.88,
  "lineas":   [{"n":1, "t0":0.40, "t1":3.54, "txt":"...", "modo":"baches"}],
  "palabras": [{"n":1, "p":"BRO,", "t0":0.40, "t1":0.68}],
  "tomas":    [{"t0":0.22,"t1":3.68,"desde":0.15,"giro":0.40,"z0":1.0,"z1":1.0,"niv":"TUT"}],
  "stickers": [{"img":3,"t0":0.26,"t1":3.62,"x":540,"y":990,"an":880,"giro":0.05}],
  "memes":    [{"k":"cerebro","t0":...,"t1":...,"x":540,"y":1250,"an":500}],
  "carteles": [{"txt":"SPIN IT","t0":...,"t1":...}],
  "marcas":   [{"txt":"REZONA AI","t0":...,"t1":...}],
  "golpes":   [{"t":0.24,"sfx":"boom","f":0.34}],
  "audio":    [{"f":"voz/v01.mp3","en":0.40,"rec":0.03,"dur":3.14}]
}
```

`t0`/`t1` are seconds on the **output** timeline. `desde` is seconds into the
**source** footage. `en` is where a voice file starts on the output timeline;
`rec` is how much leading silence to trim off it.

---

## 3. Stage 1 — Analyse the footage

Never eyeball timecodes. Measure them.

### 3.1 Find the usable region of the frame

Screen recordings carry a status bar, app chrome and a nav bar. Find the real
content rectangle by row brightness:

```bash
ffmpeg -v error -ss 20 -i source.mp4 -frames:v 1 /tmp/f.png -y
convert /tmp/f.png -resize 1x2756\! -colorspace Gray -depth 8 txt:- \
  | tail -n +2 | sed 's/.*gray(\([0-9]*\)).*/\1/' > /tmp/rows.txt
python3 - <<'PY'
v=[int(x) for x in open('/tmp/rows.txt') if x.strip().isdigit()]
prev=False
for y,b in enumerate(v):
    cur = b > 28              # 28 ≈ "not letterbox black"
    if cur != prev: print(("START" if cur else "END"), y)
    prev = cur
PY
```

Then crop to it: `-vf "crop=W:H:X:Y"`.

### 3.2 Find the dead zones

Menus, loading screens, "SOLVED!" cards and transitions are usually far
brighter or far darker than gameplay. Sample one pixel per frame at 5 fps:

```bash
ffmpeg -v error -i source.mp4 \
  -vf "crop=1268:1400:0:640,scale=1:1,fps=5" -f rawvideo -pix_fmt gray - \
| python3 -c "
import sys
v=list(sys.stdin.buffer.read()); u=205; i=0; bad=[]
while i<len(v):
    if v[i]>u:
        j=i
        while j<len(v) and v[j]>u: j+=1
        if j-i>=2: bad.append((i/5.0, j/5.0))
        i=j
    else: i+=1
print('DEAD:',  [(round(a,1),round(b,1)) for a,b in bad])
lim=[0.0]+[x for p in bad for x in p]+[len(v)/5.0]
print('CLEAN:', [(round(lim[k],1),round(lim[k+1],1)) for k in range(0,len(lim)-1,2)
                 if lim[k+1]-lim[k] > 1.0])
"
```

This produces the **clean-window map**. It is the single most valuable artifact
of this stage, because:

> **A shot must fit entirely inside one clean window.** Getting the start right
> is not enough — a 5 s shot starting 2 s before a menu will play the menu.
> This is the single most common way an otherwise good edit looks broken.

### 3.3 Label the windows

Screenshot the title area at the midpoint of each clean window and read them in
one contact sheet:

```bash
i=0; for T in 2.5 8 15 25 32 41 52 62 72 84; do i=$((i+1))
  ffmpeg -v error -ss $T -i source.mp4 -vf "crop=700:110:284:352,scale=300:-1" \
         -frames:v 1 /tmp/h_$(printf %02d $i).png -y; done
montage /tmp/h_*.png -tile 1x10 -geometry +2+2 -background "#111" /tmp/headers.png
```

Now you have `(start, end, label)` per window, and the allocator in 7.2 can
honour "show level three when the script says level three".

### 3.4 Extract frames once

```bash
ffmpeg -v error -i source.mp4 \
  -vf "crop=1268:2000:0:340,scale=900:1420,fps=30" -q:v 4 frames/%05d.jpg -y
```

Extract at the size the panel will actually occupy, as JPEG q4. ~55 KB/frame;
a 90 s recording is ~150 MB. Check `df -h` first.

---

## 4. Stage 4 — Assets

### 4.1 Cutting stickers out of a white background

Flood-fill from all four corners, keeping the sticker's own white outline:

```bash
convert in.png -alpha set -channel RGBA -fuzz 16% \
  -fill none -floodfill +1+1 white -floodfill +2046+1 white \
  -floodfill +1+2046 white -floodfill +2046+2046 white \
  +channel -trim +repage -resize 760x760\> out.png
```

`-draw "alpha x,y floodfill"` does **not** work on ImageMagick 6. Use
`-fill none -floodfill +X+Y <colour>`.

For a black background, flood-fill `black` instead. For a sheet of stickers,
`-crop 3x3@ +repage +adjoin tile_%d.png` then trim each.

### 4.2 Sizing

Store a **target width in pixels**, not a scale factor. Assets arrive at wildly
different native sizes (a 2048 px hero and a 400 px sheet crop), and one shared
scale factor makes half of them twice the size of the other half.

```js
const scale = sticker.targetWidth / img.width;
```

### 4.3 Fonts — read this, it is the "why does it look cheap" answer

**Containers do not ship Impact or Arial Black.** `font-family: Impact` silently
resolves to DejaVu Sans *Book*, and the browser fakes the weight. That is the
whole reason default text looks amateur.

```bash
fc-match "Impact"      # DejaVuSans.ttf → the font is NOT there

mkdir -p ~/.fonts && cd ~/.fonts
# Google Fonts CSS endpoint gives you the real TTF URL:
curl -sS "https://fonts.googleapis.com/css2?family=Anton" -A "Mozilla/5.0" \
  | grep -oE "https://fonts.gstatic.com/[^)]+"
curl -sSL "<that url>" -o Anton.ttf
fc-cache -f && fc-match "Anton"     # → Anton.ttf "Regular"
```

Good choices, all free:

| Font | Use |
|---|---|
| **Anton** | Heavy condensed caps. The default for this style — fits more words per line |
| **Archivo Black** | Wide and heavy. Big single words, brand plates |
| **Bebas Neue** | Tall thin condensed. Labels, lower thirds |
| **Montserrat ExtraBold** | Friendlier, more corporate |
| **Noto Sans Symbols / Noto Color Emoji** | Emoji and symbol coverage |

GitHub raw URLs are often proxy-blocked; the Google Fonts CSS endpoint is not.

### 4.4 Generated assets (Rezona)

Good prompt shape for sticker-style meme art:

```
flat vector meme sticker illustration, thick white sticker outline,
bold simple cartoon style, plain solid background, centered,
<subject>
```

with `transparent: true` and `size: "1024x1024"`. Keep a house colour in the
prompt so the set looks like one family.

---

## 5. Stage 2 — Voice

### 5.1 Use a local TTS you control

Use **Piper**. Local, fast, exact duration, and — the point — the model file
*is* the language. `es_ES-davefx-medium.onnx` cannot produce English. A hosted
TTS can hand you the wrong language and you will not notice (see section 10).

```bash
echo "Your line here." | piper -m voices/en_US-ryan-high.onnx -f out.wav
```

Useful flags: `--length-scale 1.12` (higher = slower; 1.05–1.15 is a natural
narration range), `--noise-scale 0.62` (lower = steadier).

Voices: <https://huggingface.co/rhasspy/piper-voices> — browse
`<lang>/<locale>/<name>/<quality>/`, download the `.onnx` **and** its `.onnx.json`.

```bash
B="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high"
curl -sSL "$B/en_US-ryan-high.onnx"      -o en_US-ryan-high.onnx
curl -sSL "$B/en_US-ryan-high.onnx.json" -o en_US-ryan-high.onnx.json
```

| Voice | Locale | Register |
|---|---|---|
| `en_US-ryan-high` | US English | Male, bright, young — good for short-form |
| `en_GB-alan-medium` | UK English | Male, calmer |
| `es_ES-davefx-medium` | Spain Spanish | Male, deep |
| `es_MX-ald-medium` | Mexican Spanish | Male |
| `es_AR-daniela-high` | Argentinian Spanish | Female |

### 5.2 Piper says `ImportError: numpy` — repair without touching system Python

Very common. The Debian numpy is broken; Piper's onnxruntime is fine. Drop a
known-good numpy into its own directory and put it on `PYTHONPATH`:

```bash
mkdir -p ~/pylibs && cd ~/pylibs
curl -sSL "https://pypi.org/pypi/numpy/json" -o np.json
python3 - <<'PY'
import json; d=json.load(open('np.json'))
for v in ('2.2.6','2.1.3','1.26.4'):
    for f in d['releases'].get(v,[]):
        n=f['filename']
        if 'cp311' in n and 'manylinux' in n and 'x86_64' in n and 'musl' not in n:
            print(f['url']); raise SystemExit
PY
curl -sSL "<that url>" -o np.whl
python3 -c "import zipfile; zipfile.ZipFile('np.whl').extractall('.')"
PYTHONPATH=~/pylibs python3 -c "import numpy; print(numpy.__version__)"
```

Match `cp311` to the interpreter Piper runs under. Prefix every Piper call with
`PYTHONPATH=~/pylibs`. Nothing system-wide is modified.

### 5.3 One file per line

Generate each script line separately. You get per-line durations for free, any
line can be regenerated alone, and the timeline stays assembled from real
measurements instead of guesses.

### 5.4 If you are stuck with a flaky hosted TTS

Accept or reject each take **automatically** by waveform shape. Speech has
silences; music does not:

```python
def is_speech(mp3, max_seconds):
    # returns False for "35 s of music instead of the line"
    env = rms_envelope(mp3, step_ms=62)
    peak = max(env)
    if len(env)*0.062 > max_seconds: return False      # far too long
    quiet = sum(1 for e in env if e < peak*0.06)
    return quiet >= 2                                   # has real gaps
```

Submit N takes per line in parallel, keep the first that passes. And **read the
rate-limit error**: on `RATE_LIMITED`, stop the round and double the wait.

---

## 6. Stage 3 — Word-level timing

Word-by-word subtitles need per-word timestamps. With no forced aligner
available, derive them from the energy envelope: TTS leaves a short gap between
words.

```python
def split_words(mp3, text):
    env, step, total = rms_envelope(mp3, step_ms=8)
    t0, t1 = trim_silence(env, step)                 # where speech actually starts/ends
    gaps = [g for g in find_gaps(env, step, rel=0.10, min_ms=45) if t0 < g[0] < t1]
    gaps.sort(key=lambda g: -g[1])                   # widest first
    cuts = sorted(g[0] for g in gaps[:len(words)-1])
    if len(cuts) != len(words)-1:                    # fallback
        cuts = proportional(words, t0, t1, weight=lambda w: len(w)+1.7)
    ...
```

In practice the gap method matched exactly for ~70% of lines; the proportional
fallback covers the rest. Each word is on screen ~0.3 s, so 40 ms of drift is
invisible. **Always log which method each line used** so you can spot a line
that drifted.

Subtract the leading silence when placing the file on the timeline, or every
line starts late:

```
word_time_on_timeline = line_start - leading_silence + word_time_in_file
```

---

## 7. Stage 5 — The timeline

### 7.1 Build it from measurements, never from typed timecodes

Chain the real durations. Then a line that comes out 300 ms longer shifts
everything after it instead of desynchronising the video.

### 7.2 Allocate shots automatically

Give the allocator each shot's required duration and its preferred scene label;
it finds a slot inside a clean window, advances that window's cursor, and avoids
putting the same window back-to-back.

```python
class Allocator:
    def __init__(self, windows):                     # [(start, end, label)]
        self.cur  = {w[2]: w[0]+0.15 for w in windows}
        self.end  = {w[2]: w[1] for w in windows}
        self.start= dict(self.cur)
        self.last = None
    def take(self, dur, prefer=None):
        order = ([prefer] if prefer else []) + \
                sorted(self.cur, key=lambda k: -(self.end[k]-self.cur[k]))
        for k in order:
            if (k != self.last or prefer == k) and self.end[k]-self.cur[k] >= dur:
                a = self.cur[k]; self.cur[k] = a + dur + 0.1; self.last = k
                return a, k
        k = prefer or max(self.cur, key=lambda k: self.end[k]-self.start[k])
        a = self.start[k]; self.cur[k] = a + dur + 0.1; self.last = k
        return a, k                                  # reuse rather than overflow
```

Then **assert** it worked, and print the violations:

```python
bad = [s for s in shots
       if not (win[s.label][0] <= s.src_start
               and s.src_start + s.duration <= win[s.label][1])]
```

If the script names a scene ("level three"), that shot must show it. Order the
preferences so named scenes get first claim on their window.

---

## 8. Stages 6–7 — Render, mix, encode

### 8.1 The renderer

An HTML page with a `<canvas>`, driven by Playwright. One function,
`draw(t)`, renders the frame at time `t` — no state carried between frames, so
frame 900 is identical whether rendered alone or in sequence.

```js
const b = await chromium.launch({executablePath: CHROME, args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://' + cwd + '/scene.html');
for (const i of frames) {
  const t = i / FPS;
  await p.evaluate(s => window.setFootageFrame(s), footagePathFor(t));
  await p.evaluate(tt => window.draw(tt), t);
  await p.locator('#c').screenshot({path: `out/${String(i).padStart(5,'0')}.png`});
}
```

Throughput is ~1.2–1.6 frames/s at 1080×1920, i.e. **~20 minutes per rendered
minute**. Plan for it. Render in chunks with a `SOLO=start,end` range so a
crash costs one chunk, not the job.

Draw into an offscreen canvas and blit to the visible one at the end. Whole-frame
effects — zoom punch, chromatic aberration, shake — need the assembled image.

```js
function present(t){
  const f = hitStrength(t, beats);
  if (f < 0.01) { VIS.drawImage(OFF, 0, 0); return; }
  const z = 1 + 0.05*f, dx = (W-W*z)/2, dy = (H-H*z)/2;
  VIS.drawImage(OFF, dx, dy, W*z, H*z);
  const d = 9*f;                                   // channel split
  for (const [col, sx] of [['#ff0000',-d], ['#00ffff', d]]) {
    TMP.globalCompositeOperation='source-over'; TMP.clearRect(0,0,W,H);
    TMP.drawImage(OFF, dx, dy, W*z, H*z);
    TMP.globalCompositeOperation='multiply'; TMP.fillStyle=col; TMP.fillRect(0,0,W,H);
    VIS.globalCompositeOperation='lighter'; VIS.globalAlpha=0.5;
    VIS.drawImage(TMPCANVAS, sx, 0);
  }
  VIS.globalAlpha=1; VIS.globalCompositeOperation='source-over';
}
```

Apply the expensive pass **only on hit frames** (~8 frames per beat). Doing it
every frame triples render time for something nobody sees.

### 8.2 Fake 3D perspective in 2D canvas

Canvas 2D has no perspective transform. Slice the image into vertical strips and
give each its own scale and offset:

```js
function perspective(img, cx, cy, w, h, angle, radius){
  const N = 128, d = 2.25, sw = img.width / N;
  ctx.save(); roundRect(cx-w/2-4, cy-h/2-4, w+8, h+8, radius); ctx.clip();
  for (let i = 0; i < N; i++) {
    const u0 = (i/N-.5)*2, u1 = ((i+1)/N-.5)*2;
    const px = u => (u*Math.cos(angle)) / (d + u*Math.sin(angle)) * (w/2);
    const sc = u => d / (d + u*Math.sin(angle));
    const x0 = cx+px(u0), x1 = cx+px(u1), hm = (h*sc(u0)+h*sc(u1))/2;
    ctx.drawImage(img, i*sw, 0, sw, img.height,
                  Math.min(x0,x1), cy-hm/2, Math.abs(x1-x0)+2.2, hm);
  }
  ctx.restore();
}
```

Two details that matter: **128 strips** (48 shows seams) and **+2.2 px overlap**
per strip (without it you see background between strips). And fade any
straight-rectangle border out while `|angle| > 0` — a straight border on a
rotated plane is instantly wrong.

### 8.3 Audio

Three tracks, then one mix.

```bash
# Voice: trim each file's leading silence, place it, pad, sum
[0:a]atrim=start=0.03,asetpts=PTS-STARTPTS,adelay=400|400,apad[v0]; ...
[v0][v1][v2]amix=inputs=3:normalize=0,dynaudnorm=f=180:g=9,alimiter=limit=0.94[voice]

# Music bed: chain short pieces with crossfades, loop, fade, and keep it quiet
[m0][m1]acrossfade=d=1.2:c1=tri:c2=tri[x1]; [x1][m2]acrossfade=d=1.2...[xN]
[xN]aloop=loop=2:size=2147483647,atrim=0:DUR,volume=0.30,
    afade=t=in:st=0:d=1.4,afade=t=out:st=DUR-1.6:d=1.6[bed]

# Mix, with the bed ducking under the voice — this is what makes it audible
[0:a]asplit=2[vz][key];
[1:a][key]sidechaincompress=threshold=0.055:ratio=9:attack=8:release=320[duck];
[vz][duck][2:a]amix=inputs=3:normalize=0[m];
[m]loudnorm=I=-14:TP=-1.2:LRA=11,alimiter=limit=0.97[out]
```

`I=-14 LUFS` is the streaming-platform norm. Without `sidechaincompress` the
music sits on top of the voice and the video is unwatchable.

> **Bug to avoid:** when building the SFX graph, number the filter labels by
> *files that actually existed*, not by index into your beat list. Skip a
> missing file and you get `[s2] matches no streams` and the whole graph dies.

### 8.4 Encode

```bash
ffmpeg -framerate 30 -pattern_type glob -i 'frames/*.png' -i mix.wav \
  -map 0:v -map 1:a \
  -c:v libx264 -preset slower -crf 20 -pix_fmt yuv420p \
  -profile:v high -level 4.1 \
  -c:a aac -b:a 160k -ar 48000 \
  -movflags +faststart -shortest out.mp4
```

- `-pattern_type glob`, **not** `image2` — `image2` starts at `00001` and
  silently drops frame `00000`.
- `-pix_fmt yuv420p` or phones will not play it.
- `+faststart` so it streams without a full download.
- For a size target, swap `-crf` for `-b:v 3000k -maxrate 3700k -bufsize 6400k`.
- Animated backgrounds are expensive. Never add an ffmpeg `noise` filter — it
  destroyed temporal compression and took one file from 16 MB to 171 MB.

---

## 9. Twenty editing styles you can just dictate

Say the name. Combine freely — "stacked subs, orange keyword, perspective
swings, zoom punch on every beat".

⚙ = works with ffmpeg alone, no browser needed.

| # | Say this | What you get |
|---|---|---|
| 1 | **"Word-by-word karaoke"** | One huge word at a time, swapped on the beat. Maximum punch, lowest reading comfort |
| 2 | **"Stacked subtitles"** | Words accumulate into the phrase, wrapped by measured width. The current word in an accent colour. Best default |
| 3 | **"Orange keyword"** | Active word (or a chosen keyword) in the brand colour, the rest white |
| 4 | **"Full-screen text beat"** | 1–2 s with no narration: giant text + one sound effect. Great for punchlines — `NO JUMP` / `NO FLY` / `NO RUN` as three rhythm hits |
| 5 | **"Zoom punch"** | Whole frame scales ~5% and springs back on each hit |
| 6 | **"RGB split" / "chromatic hit"** | Red/cyan channel separation on impact frames |
| 7 | **"Perspective swing"** | Shots enter rotated on the Y axis and settle flat, alternating sides |
| 8 | **"Whip pan"** ⚙ | Fast directional blur between shots |
| 9 | **"Glitch cut"** | Block displacement + channel tear for 3–5 frames |
| 10 | **"Speed ramp"** ⚙ | Slow into the beat, snap fast out. `setpts` + `atempo` |
| 11 | **"Ken Burns" / "always moving"** | Continuous slow drift and breathing scale so nothing is ever static |
| 12 | **"Reaction sticker"** | Character cut-outs straddling the footage edge, matched to the emotional beat |
| 13 | **"Meme cut-in"** | A meme image drops over the footage for ~1.5 s on a punchline |
| 14 | **"Freeze and annotate"** ⚙ | Hold a frame, draw a circle or arrow, resume |
| 15 | **"Highlight ring"** | Hand-drawn circle or arrow tracking a point of interest |
| 16 | **"Lower third" / "scene card"** | Sliding label plate — `LEVEL 3`, `SPIN IT`, `PUSH THE BLOCK` |
| 17 | **"Progress bar"** | Thin bar across the bottom. Measurably improves completion rate |
| 18 | **"Brand curtain"** | Full-screen dim + logo stinger at the hook and the CTA |
| 19 | **"Animated background"** | Perspective grid, topographic contours, floating particles behind everything |
| 20 | **"Colour grade"** ⚙ | `saturate(128%) contrast(110%) brightness(104%)`. Raw screen recordings look washed out against a saturated background |
| 21 | **"Split screen"** ⚙ | Two sources side by side or stacked |
| 22 | **"Shake"** | Sub-pixel jitter on heavy hits |
| 23 | **"Countdown / listicle"** | `5… 4… 3…` with a card and a tick per item |
| 24 | **"Flash cut"** | One white frame at 40% on hard transitions |

**Sound vocabulary** — say these and Claude places them: `vine boom`, `record
scratch`, `air horn`, `error buzzer`, `sad trombone`, `level up`, `swoosh`,
`slide`, `pop`, `tap`, `bubble`, `sparkle`, `riser`, `typing`, `mechanical spin`.

**Structure vocabulary**: `hook first`, `tell the gameplay`, `storytime`,
`problem → discovery → payoff`, `CTA at the end`, `max 60 seconds`,
`one sentence per shot`.

---

## 10. Verification — the part people skip

Claude cannot see the video play and cannot hear the audio. Everything below is
a thing that *was* shipped broken because it was not measured.

> **The one that cost the most:** narration was delivered **in the wrong
> language**, twice. Pitch, waveform shape, duration and per-line placement had
> all been measured. Language had not. A hosted TTS will happily read Spanish
> text in English and nothing about the signal says so.
>
> **Fix:** use a TTS whose model file *is* the language, and say so in the
> report. `es_ES-davefx-medium.onnx` is monolingual — it is a structural
> guarantee, not a hope. If you must use a hosted TTS, get a transcript back and
> check it, or have the user listen to one line before you render 2000 frames.

Run all of these before delivering:

```bash
# 1. Frame sequence is complete, in order, and single-writer
python3 -c "
import os,glob
fs=sorted(glob.glob('frames/*.png')); t=[os.path.getmtime(f) for f in fs]
print('count', len(fs))
print('gaps',  [i for i in range(len(fs)) if fs[i]!='frames/%05d.png'%i][:3] or 'none')
print('out-of-order', sum(1 for i in range(len(t)-1) if t[i+1] < t[i]-1))
print('smallest', min(os.path.getsize(f) for f in fs))
"
```

`out-of-order > 0` means **two render processes wrote the same directory** and
the output is a mix of two versions. It looks fine frame by frame and wrong in
motion. Kill by PID, verify `pgrep` returns nothing, then re-render.

```bash
# 2. Audio is present and not silent
ffmpeg -v error -i out.mp4 -ac 1 -ar 8000 /tmp/a.wav -y
python3 -c "
import wave,array,math
w=wave.open('/tmp/a.wav','rb'); sr=w.getframerate()
d=array.array('h'); d.frombytes(w.readframes(w.getnframes())); p=sr*2
e=[math.sqrt(sum(x*x for x in d[i:i+p])/p) for i in range(0,len(d)-p,p)]
print('dur %.1fs  mean RMS %d  min %d' % (len(d)/sr, sum(e)/len(e), min(e)))"
```

```bash
# 3. Every voice line lands in its slot
#    (compare the voice track's energy against guion.json line windows;
#     anything under ~55% coverage is misplaced)
```

```bash
# 4. Voice pitch — WITH octave correction
#    Naive autocorrelation locks onto the harmonic and reports double.
#    Among peaks above 86% of the max, take the LONGEST lag.
#    Male ≈ 85–180 Hz, female ≈ 165–255 Hz.
```

```bash
# 5. No shot crosses a dead zone  (assert in the timeline builder — section 7.2)
```

```bash
# 6. Contact sheet — the only way to actually look at the result
ffmpeg -v error -i out.mp4 -vf "fps=1/2.5,scale=176:-1,tile=9x3" -frames:v 1 sheet.jpg -y
```

**Always build the contact sheet and look at it before delivering.** It catches
what no measurement does: menus instead of gameplay, text colliding, a sticker
covering the subject, an empty ending.

Last: **check the file size against the delivery limit before sending.** 30 MiB
is a common ceiling; re-encode with a bitrate target rather than making the user
ask.

---

## 11. Known failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Text looks cheap and generic | Impact/Arial Black are not installed; fontconfig substituted silently | Install Anton (4.3). Check with `fc-match` |
| Narration is in the wrong language | Hosted TTS ignored the text's language | Local Piper with a monolingual model (5.1) |
| Voice comes back as ~35 s of music | Hosted speech endpoint failure mode | Piper; or auto-reject by waveform (5.4) |
| Menus / loading screens appear mid-shot | Shot start was measured, shot *end* was not | Clean-window map + allocator assert (3.2, 7.2) |
| Subtitles drift out of sync | Timeline uses typed timecodes | Chain measured durations (7.1) |
| First frame missing from the encode | `image2` demuxer starts at `00001` | `-pattern_type glob` |
| Frames look mixed between two versions | Two renderers wrote one directory | Kill by PID, verify, re-render (10) |
| `kill` did not stop the render | `pkill -f <pattern>` can match the calling shell and kill it (exit 144) | `pgrep` → `kill -9 <pid>` → verify `pgrep` is empty |
| `[s2] matches no streams` | SFX filter labels numbered by beat index, not by files found | Number by successful additions (8.3) |
| Encode ballooned to 10× the size | An ffmpeg `noise` filter destroyed temporal compression | Remove it |
| Seams or background between perspective strips | Too few strips, no overlap | 128 strips, +2.2 px (8.2) |
| Hover/press effect does nothing | Selector does not match anything | Verify the class exists before styling it |
| A blanket rule broke component styling | e.g. `button:hover{filter:…}` at (0,2,1) outranks `.orb:hover` at (0,2,0) | Do not write blanket aesthetic rules; re-declare per component |
| Everything stops generating at once | Rate limit, and the retry loop ignored the error | Read the error, back off exponentially (1.3) |
| Work lost on container restart | Long jobs held only in memory / background processes | Write to disk every stage; render in resumable chunks |
| `Date.now()` / `Math.random()` in the renderer | Non-deterministic frames | Derive everything from `t` and the element index |

---

## 12. Working agreement

**Claude should:**

- Run the preflight and report it before promising anything.
- Say which styles are unavailable given what it found, rather than silently
  producing something lesser.
- Give the Rezona pairing URL and let the user approve in their own browser —
  never ask for a pasted key.
- Measure instead of eyeballing: crop rectangles, dead zones, word timings,
  pitch, levels.
- Build the contact sheet and look at it before delivering.
- Report failures with the actual number ("30 attempts, 1 succeeded"), not a
  vague apology.
- Bring up a desktop on its own initiative when the preflight finds none
  (section 1.4), and send a screenshot as soon as it is up.
- Send screenshots and contact sheets instead of describing what a screen
  looks like.
- Ask first only for things that touch someone else: installing packages on a
  shared or production box, or spending generation credits at scale.

**Claude should not:**

- Put identifiable real people's photos or footage into promotional material
  without permission. Generate the meme art instead — it also keeps the house
  palette.
- Claim authorship of third-party software or content on the user's behalf.
  Write "it's on our site", not "we made it", unless the user confirms.
- Leave long jobs running in the background without telling the user, or claim
  a background job finished without checking.
- Say "it looks right" without attaching the picture that shows it.
- Start a second renderer against a directory another one is writing.

**The user should expect:** ~20 minutes of render per finished minute of video,
plus generation and encode. A 60-second video is roughly a 30–40 minute job the
first time, and minutes for each revision afterwards — the timeline, assets and
voice are all reusable; only the changed stage re-runs.

---

## 13. Quick start

```
1. Paste this file to Claude.
2. "Run the preflight."
3. Fix or approve whatever it reports (Rezona pairing link, font install,
   numpy repair).
4. Hand it the footage and say what the video is about.
5. Dictate the style:
   "Stacked subtitles, orange keyword, perspective swings, zoom punch on
    every beat, vine boom on the punchlines, animated grid background,
    progress bar, brand curtain at the start and end, max 60 seconds."
6. Look at the contact sheet it shows you. Ask for changes. Only the changed
   stage re-runs.
```
