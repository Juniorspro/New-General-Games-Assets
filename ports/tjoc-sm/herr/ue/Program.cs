// Saca datos de TJOC:SM (Unreal 4.16) con CUE4Parse. Todo sale ya en espacio three.js: x=X, y=Z, z=Y, metros.
using Serilog;
using CUE4Parse.FileProvider;
using CUE4Parse.UE4.Versions;
using CUE4Parse.UE4.Assets.Exports;
using CUE4Parse.UE4.Assets.Exports.StaticMesh;
using CUE4Parse.UE4.Assets.Exports.SkeletalMesh;
using CUE4Parse.UE4.Assets.Exports.Texture;
using CUE4Parse.UE4.Assets.Exports.Animation;
using CUE4Parse.UE4.Assets.Exports.Sound;
using CUE4Parse.UE4.Objects.Core.Math;
using CUE4Parse_Conversion.Meshes;
using CUE4Parse_Conversion.Textures;
using CUE4Parse_Conversion.Sounds;
using CUE4Parse_Conversion.Animations;
using Newtonsoft.Json;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

Serilog.Log.Logger = new Serilog.LoggerConfiguration().MinimumLevel.Warning().WriteTo.Console(standardErrorFromLevel: Serilog.Events.LogEventLevel.Verbose).CreateLogger();
var provider = new DefaultFileProvider(args[0], SearchOption.TopDirectoryOnly, new VersionContainer(Enum.Parse<EGame>(Environment.GetEnvironmentVariable("UEVER") ?? "GAME_UE4_17")));
provider.ReadScriptData = true;
provider.Initialize();
provider.Mount();
var cmd = args[1]; var outDir = args.Length > 2 ? args[2] : ".";
var items = new List<string>();
for (int i = 3; i < args.Length; i++) { if (args[i].StartsWith("@")) items.AddRange(File.ReadAllLines(args[i][1..]).Where(l => l.Trim() != "")); else items.Add(args[i]); }
Directory.CreateDirectory(outDir);
string Seguro(string p) => p.Replace('/', '~');
UObject Cargar(string r) { var k = r.LastIndexOf('.'); return k > r.LastIndexOf('/') ? provider.LoadPackageObject(r[..k], r[(k + 1)..]) : provider.LoadPackageObject(r); }
static float[] P(FVector v) => new[] { v.X * 0.01f, v.Z * 0.01f, v.Y * 0.01f };
static float[] Q(FQuat q) => new[] { -q.X, -q.Z, -q.Y, q.W };
int malos = 0;
foreach (var it in items) {
  try {
    switch (cmd) {
      case "lista": break;
      case "json": {
        var pkg = provider.LoadPackage(it);
        File.WriteAllText(Path.Combine(outDir, Seguro(it) + ".json"), JsonConvert.SerializeObject(pkg.GetExports(), Formatting.None));
        break; }
      case "tex": { // it = ruta|tamañoMax
        var parts = it.Split('|'); var max = parts.Length > 1 ? int.Parse(parts[1]) : 512;
        var tex = (UTexture)Cargar(parts[0]);
        var c = TextureDecoder.Decode(tex, max);
        var d = c.Data; var w = c.Width; var h = c.Height; var fmt = c.PixelFormat.ToString();
        Image img;
        if (fmt.Contains("B8G8R8A8")) { var x = Image.LoadPixelData<Bgra32>(d, w, h); img = x; }
        else if (fmt.Contains("R8G8B8A8")) img = Image.LoadPixelData<Rgba32>(d, w, h);
        else if (fmt == "PF_G8" || fmt.Contains("R8") && d.Length == w * h) img = Image.LoadPixelData<L8>(d, w, h);
        else if (d.Length == w * h * 4) img = Image.LoadPixelData<Bgra32>(d, w, h);
        else throw new Exception("formato " + fmt + " " + d.Length + " " + w + "x" + h);
        img.SaveAsPng(Path.Combine(outDir, Seguro(parts[0]) + ".png"));
        Console.WriteLine($"{parts[0]}\t{w}x{h}\t{fmt}\t{tex.GetType().Name}");
        break; }
      case "malla": {
        var o = Cargar(it); var meta = new Dictionary<string, object>();
        using var bw = new BinaryWriter(File.Create(Path.Combine(outDir, Seguro(it) + ".bin")));
        if (o is UStaticMesh sm) {
          if (!MeshConverter.TryConvert(sm, out var m)) throw new Exception("no convierte");
          var lod = m.LODs[0]; var lmi = sm.GetOrDefault<int>("LightMapCoordinateIndex", 0);
          meta["tipo"] = "static"; meta["lmi"] = lmi; meta["lmres"] = sm.GetOrDefault<int>("LightMapResolution", 0);
          meta["nv"] = lod.Vertices.Length; meta["ni"] = lod.Indices.Length; meta["nuv"] = 1 + (lod.ExtraUvs?.Length ?? 0);
          meta["secs"] = lod.Sections.Select(s => new[] { s.FirstIndex, s.NumFaces * 3, s.MaterialIndex }).ToArray();
          meta["mats"] = m.Materials.Select(x => x.Material?.ResolvedObject?.GetPathName()).ToArray();
          meta["slots"] = m.Materials.Select(x => x.SlotName).ToArray();
          meta["doble"] = lod.IsTwoSided;
          meta["colores"] = lod.VertexColors?.Length ?? 0;
          meta["cuerpo"] = sm.BodySetup?.ResolvedObject?.GetPathName();
          foreach (var v in lod.Vertices) { var p = P(v.Position); bw.Write(p[0]); bw.Write(p[1]); bw.Write(p[2]); }
          foreach (var v in lod.Vertices) { bw.Write(v.Normal.X); bw.Write(v.Normal.Z); bw.Write(v.Normal.Y); }
          foreach (var v in lod.Vertices) { bw.Write(v.Uv.U); bw.Write(v.Uv.V); }
          if (lmi > 0 && lod.ExtraUvs != null && lod.ExtraUvs.Length >= lmi) { meta["uv2"] = true; foreach (var u in lod.ExtraUvs[lmi - 1]) { bw.Write(u.U); bw.Write(u.V); } }
          if (lod.VertexColors?.Length > 0) foreach (var c in lod.VertexColors[0].Colors) { bw.Write(c.R); bw.Write(c.G); bw.Write(c.B); bw.Write(c.A); }
          for (int i = 0; i < lod.Indices.Length; i += 3) { bw.Write(lod.Indices[i]); bw.Write(lod.Indices[i + 2]); bw.Write(lod.Indices[i + 1]); }
        } else if (o is USkeletalMesh sk) {
          if (!MeshConverter.TryConvert(sk, out var m)) throw new Exception("no convierte");
          var lod = m.LODs[0];
          meta["tipo"] = "skel"; meta["nv"] = lod.Vertices.Length; meta["ni"] = lod.Indices.Length;
          meta["secs"] = lod.Sections.Select(s => new[] { s.FirstIndex, s.NumFaces * 3, s.MaterialIndex }).ToArray();
          meta["mats"] = m.Materials.Select(x => x.Material?.ResolvedObject?.GetPathName()).ToArray();
          meta["slots"] = m.Materials.Select(x => x.SlotName).ToArray();
          meta["huesos"] = m.Bones.Select(b => new { n = b.Name, p = b.ParentIndex, t = P(b.Transform.Translation), r = Q(b.Transform.Rotation), s = new[] { b.Transform.Scale3D.X, b.Transform.Scale3D.Z, b.Transform.Scale3D.Y } }).ToArray();
          var socks = new List<object>();
          foreach (var s in sk.Sockets ?? Array.Empty<CUE4Parse.UE4.Objects.UObject.FPackageIndex>()) {
            var so = s.Load(); if (so == null) continue;
            var rl = so.GetOrDefault<FVector>("RelativeLocation"); var rr = so.GetOrDefault<FRotator>("RelativeRotation"); var rs = so.GetOrDefault<FVector>("RelativeScale", new FVector(1, 1, 1));
            socks.Add(new { n = so.GetOrDefault<CUE4Parse.UE4.Objects.UObject.FName>("SocketName").Text, h = so.GetOrDefault<CUE4Parse.UE4.Objects.UObject.FName>("BoneName").Text, t = P(rl), r = Q(rr.Quaternion()), s = new[] { rs.X, rs.Z, rs.Y } });
          }
          meta["sockets"] = socks;
          meta["esqueleto"] = sk.Skeleton?.ResolvedObject?.GetPathName();
          foreach (var v in lod.Vertices) { var p = P(v.Position); bw.Write(p[0]); bw.Write(p[1]); bw.Write(p[2]); }
          foreach (var v in lod.Vertices) { bw.Write(v.Normal.X); bw.Write(v.Normal.Z); bw.Write(v.Normal.Y); }
          foreach (var v in lod.Vertices) { bw.Write(v.Uv.U); bw.Write(v.Uv.V); }
          foreach (var v in lod.Vertices) {
            var inf = v.Influences.OrderByDescending(x => x.Weight).Take(4).ToArray(); float tot = inf.Sum(x => x.Weight); if (tot <= 0) tot = 1;
            for (int k = 0; k < 4; k++) bw.Write((ushort)(k < inf.Length ? inf[k].Bone : 0));
            for (int k = 0; k < 4; k++) bw.Write(k < inf.Length ? inf[k].Weight / tot : 0f);
          }
          for (int i = 0; i < lod.Indices.Length; i += 3) { bw.Write(lod.Indices[i]); bw.Write(lod.Indices[i + 2]); bw.Write(lod.Indices[i + 1]); }
        } else throw new Exception("tipo " + o?.GetType().Name);
        File.WriteAllText(Path.Combine(outDir, Seguro(it) + ".json"), JsonConvert.SerializeObject(meta));
        break; }
      case "anim": {
        var a = (UAnimSequence)Cargar(it);
        var set = AnimConverter.ConvertAnims(a); var seq = set.Sequences[0];
        var sk = set.Skeleton; var nombres = sk.ReferenceSkeleton.FinalRefBoneInfo.Select(b => b.Name.Text).ToArray();
        var refp = sk.ReferenceSkeleton.FinalRefBonePose;
        var pistas = new List<object>();
        int nf = Math.Max(1, seq.NumFrames);
        for (int b = 0; b < seq.Tracks.Count && b < nombres.Length; b++) {
          var tr = seq.Tracks[b]; if (!tr.HasKeys()) { pistas.Add(null); continue; }
          var pos = new List<float>(); var rot = new List<float>(); var esc = new List<float>();
          for (int f = 0; f < nf; f++) {
            var q = refp[b].Rotation; var p = refp[b].Translation; var s = refp[b].Scale3D;
            tr.GetBoneTransform(f, nf, ref q, ref p, ref s);
            pos.AddRange(P(p)); rot.AddRange(Q(q)); esc.AddRange(new[] { s.X, s.Z, s.Y });
          }
          pistas.Add(new { p = pos, r = rot, s = esc });
        }
        var meta = new { nombre = a.Name, fps = seq.FramesPerSecond, frames = nf, dur = a.SequenceLength, aditiva = seq.IsAdditive, esqueleto = sk.GetPathName(), huesos = nombres, pistas };
        File.WriteAllText(Path.Combine(outDir, Seguro(it) + ".json"), JsonConvert.SerializeObject(meta));
        break; }
      case "snd": {
        var o = Cargar(it);
        SoundDecoder.Decode(o, true, out var fmt, out var data);
        if (data == null) throw new Exception("sin datos");
        File.WriteAllBytes(Path.Combine(outDir, Seguro(it) + "." + fmt.ToLower()), data);
        break; }
      case "exp": { // ruta|regex: bytes crudos de cada export cuyo nombre coincida + mapa de nombres
        var parts = it.Split('|'); var pkg = (CUE4Parse.UE4.Assets.Package)provider.LoadPackage(parts[0]);
        var rx = new System.Text.RegularExpressions.Regex(parts.Length > 1 ? parts[1] : ".");
        var uexp = provider.Files[parts[0] + ".uexp"].Read(); var hdr = pkg.Summary.TotalHeaderSize;
        File.WriteAllLines(Path.Combine(outDir, Seguro(parts[0]) + ".nombres.txt"), pkg.NameMap.Select(n => n.Name));
        for (int i = 0; i < pkg.ExportMap.Length; i++) {
          var ex = pkg.ExportMap[i]; var nm = ex.ObjectName.Text;
          if (!rx.IsMatch(nm)) continue;
          var off = ex.SerialOffset - hdr; var b = new byte[ex.SerialSize]; Array.Copy(uexp, off, b, 0, ex.SerialSize);
          File.WriteAllBytes(Path.Combine(outDir, Seguro(parts[0]) + "." + i + "." + nm + ".bin"), b);
        }
        break; }
      case "crudo": { // bytes de un archivo del pak tal cual
        var f = provider.Files[it]; File.WriteAllBytes(Path.Combine(outDir, Seguro(it)), f.Read()); break; }
    }
  } catch (Exception ex) { malos++; Console.Error.WriteLine($"MAL {it}: {ex.Message}"); }
}
if (cmd == "lista") foreach (var k in provider.Files.Keys) Console.WriteLine(k);
Console.Error.WriteLine($"listo, {malos} fallas");
