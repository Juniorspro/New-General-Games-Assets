import json, sys, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
modelo = sys.argv[1]
op = vision.HandLandmarkerOptions(base_options=BaseOptions(model_asset_path=modelo), num_hands=2, running_mode=vision.RunningMode.IMAGE)
det = vision.HandLandmarker.create_from_options(op)
salida = {}
for n in ["thumb_up", "pointing_up", "pointing_up_rotated", "fist", "victory", "right_hands", "left_hands", "woman_hands"]:
    img = mp.Image.create_from_file(n + ".jpg")
    r = det.detect(img)
    manos = []
    for i, lm in enumerate(r.hand_landmarks):
        wl = r.hand_world_landmarks[i]
        manos.append({"img": [[p.x, p.y, p.z] for p in lm], "mundo": [[p.x, p.y, p.z] for p in wl],
                      "lado": r.handedness[i][0].category_name, "w": img.width, "h": img.height})
    salida[n] = manos
    print(n, len(manos), "manos")
json.dump(salida, open("manos.json", "w"))
