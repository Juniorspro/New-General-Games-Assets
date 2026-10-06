/* Funciones nativas puras de Unreal 4.16 (KismetMath/String/Text/Array/System/NodeHelper) con su semántica.
   Firma: (T, vals, refs, F, vm). Vectores {X,Y,Z}, rotadores {Pitch,Yaw,Roll} en grados, todo en espacio UE. */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const V = (X = 0, Y = 0, Z = 0) => ({ X, Y, Z });
export const vadd = (a, b) => V(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
export const vsub = (a, b) => V(a.X - b.X, a.Y - b.Y, a.Z - b.Z);
export const vmul = (a, k) => V(a.X * k, a.Y * k, a.Z * k);
export const vlen = (a) => Math.hypot(a.X, a.Y, a.Z);
export const vdot = (a, b) => a.X * b.X + a.Y * b.Y + a.Z * b.Z;
const sc = (deg) => [Math.sin(deg * D2R), Math.cos(deg * D2R)];
export function rotEjes(r) {
  const [SP, CP] = sc(r.Pitch || 0), [SY, CY] = sc(r.Yaw || 0), [SR, CR] = sc(r.Roll || 0);
  return {
    x: V(CP * CY, CP * SY, SP),
    y: V(SR * SP * CY - CR * SY, SR * SP * SY + CR * CY, -SR * CP),
    z: V(-(CR * SP * CY + SR * SY), CY * SR - CR * SP * SY, CR * CP),
  };
}
export function rotAQuat(r) {
  const h = D2R / 2;
  const [SP, CP] = [Math.sin((r.Pitch || 0) * h), Math.cos((r.Pitch || 0) * h)], [SY, CY] = [Math.sin((r.Yaw || 0) * h), Math.cos((r.Yaw || 0) * h)], [SR, CR] = [Math.sin((r.Roll || 0) * h), Math.cos((r.Roll || 0) * h)];
  return { X: CR * SP * SY - SR * CP * CY, Y: -CR * SP * CY - SR * CP * SY, Z: CR * CP * SY - SR * SP * CY, W: CR * CP * CY + SR * SP * SY };
}
export function quatARot(q) {
  const { X, Y, Z, W } = q;
  const SingTest = Z * X - W * Y, YawY = 2 * (W * Z + X * Y), YawX = 1 - 2 * (Y * Y + Z * Z), TH = 0.4999995;
  const r = { Pitch: 0, Yaw: Math.atan2(YawY, YawX) * R2D, Roll: 0 };
  if (SingTest < -TH) { r.Pitch = -90; r.Roll = normEje(-r.Yaw - 2 * Math.atan2(X, W) * R2D); }
  else if (SingTest > TH) { r.Pitch = 90; r.Roll = normEje(r.Yaw - 2 * Math.atan2(X, W) * R2D); }
  else { r.Pitch = Math.asin(2 * SingTest) * R2D; r.Roll = Math.atan2(-2 * (W * X + Y * Z), 1 - 2 * (X * X + Y * Y)) * R2D; }
  return r;
}
export const normEje = (a) => { a = a % 360; if (a > 180) a -= 360; if (a < -180) a += 360; return a; };
export const rotDesdeX = (d) => ({ Pitch: Math.atan2(d.Z, Math.hypot(d.X, d.Y)) * R2D, Yaw: Math.atan2(d.Y, d.X) * R2D, Roll: 0 });
export function qmul(a, b) {
  return { X: a.W * b.X + a.X * b.W + a.Y * b.Z - a.Z * b.Y, Y: a.W * b.Y - a.X * b.Z + a.Y * b.W + a.Z * b.X, Z: a.W * b.Z + a.X * b.Y - a.Y * b.X + a.Z * b.W, W: a.W * b.W - a.X * b.X - a.Y * b.Y - a.Z * b.Z };
}
export function qrot(q, v) { // rota v por q
  const u = V(q.X, q.Y, q.Z), s = q.W;
  const t = vmul(V(u.Y * v.Z - u.Z * v.Y, u.Z * v.X - u.X * v.Z, u.X * v.Y - u.Y * v.X), 2);
  return vadd(vadd(v, vmul(t, s)), V(u.Y * t.Z - u.Z * t.Y, u.Z * t.X - u.X * t.Z, u.X * t.Y - u.Y * t.X));
}
export function slerp(a, b, t) {
  let d = a.X * b.X + a.Y * b.Y + a.Z * b.Z + a.W * b.W, bb = b;
  if (d < 0) { d = -d; bb = { X: -b.X, Y: -b.Y, Z: -b.Z, W: -b.W }; }
  let k0, k1;
  if (d > 0.9999) { k0 = 1 - t; k1 = t; } else { const o = Math.acos(d), so = Math.sin(o); k0 = Math.sin((1 - t) * o) / so; k1 = Math.sin(t * o) / so; }
  const r = { X: a.X * k0 + bb.X * k1, Y: a.Y * k0 + bb.Y * k1, Z: a.Z * k0 + bb.Z * k1, W: a.W * k0 + bb.W * k1 };
  const n = Math.hypot(r.X, r.Y, r.Z, r.W) || 1; r.X /= n; r.Y /= n; r.Z /= n; r.W /= n; return r;
}
const set = (refs, i, v) => { if (refs[i]) refs[i].set(v); };
function floatStr(x) { // FString::SanitizeFloat
  if (!isFinite(x)) return String(x);
  let s = x.toFixed(6).replace(/0+$/, ''); if (s.endsWith('.')) s += '0'; if (s === '-0.0') s = '0.0'; return s;
}
function ease(a, b, t, f, exp = 2, steps = 2) {
  const fns = [
    (x) => x, // Linear
    (x) => (steps < 1 ? x : Math.floor(x * steps) / steps), // Step
    (x) => (x < 0.5 ? Math.pow(2 * x, 0.5) / 2 * 1 : x), // placeholder sin uso
  ];
  let k;
  switch (f) {
    case 0: k = t; break; case 1: k = steps < 1 ? t : Math.floor(t * steps) / Math.max(1, steps - 1); break;
    case 2: k = Math.sin(t * Math.PI / 2 - Math.PI / 2) + 1; break; case 3: k = Math.sin(t * Math.PI / 2); break; case 4: k = -0.5 * (Math.cos(Math.PI * t) - 1); break;
    case 5: k = Math.pow(t, exp); break; case 6: k = 1 - Math.pow(1 - t, exp); break; case 7: k = t < 0.5 ? 0.5 * Math.pow(2 * t, exp) : 1 - 0.5 * Math.pow(2 * (1 - t), exp); break;
    case 8: k = Math.pow(2, 10 * (t - 1)); break; case 9: k = 1 - Math.pow(2, -10 * t); break; case 10: k = t < 0.5 ? 0.5 * Math.pow(2, 10 * (2 * t - 1)) : 1 - 0.5 * Math.pow(2, -10 * (2 * t - 1)); break;
    case 11: k = 1 - Math.sqrt(1 - t * t); break; case 12: k = Math.sqrt(1 - (t - 1) * (t - 1)); break;
    case 13: k = t < 0.5 ? 0.5 * (1 - Math.sqrt(1 - 4 * t * t)) : 0.5 * (Math.sqrt(1 - (2 * t - 2) ** 2) + 1); break;
    default: k = t;
  }
  void fns;
  return a + (b - a) * k;
}
export const LIBS = {
  // ---------------- matemática ----------------
  'KismetMathLibrary:Abs': (T, [a]) => Math.abs(a),
  'KismetMathLibrary:Add_ByteByte': (T, [a, b]) => (a + b) & 255,
  'KismetMathLibrary:Add_FloatFloat': (T, [a, b]) => a + b,
  'KismetMathLibrary:Add_IntInt': (T, [a, b]) => (a + b) | 0,
  'KismetMathLibrary:Add_VectorVector': (T, [a, b]) => vadd(a, b),
  'KismetMathLibrary:Subtract_FloatFloat': (T, [a, b]) => a - b,
  'KismetMathLibrary:Subtract_IntInt': (T, [a, b]) => (a - b) | 0,
  'KismetMathLibrary:Subtract_VectorVector': (T, [a, b]) => vsub(a, b),
  'KismetMathLibrary:Multiply_FloatFloat': (T, [a, b]) => a * b,
  'KismetMathLibrary:Multiply_IntFloat': (T, [a, b]) => a * b,
  'KismetMathLibrary:Multiply_IntInt': (T, [a, b]) => Math.imul(a, b),
  'KismetMathLibrary:Multiply_VectorFloat': (T, [a, k]) => vmul(a, k),
  'KismetMathLibrary:Multiply_VectorVector': (T, [a, b]) => V(a.X * b.X, a.Y * b.Y, a.Z * b.Z),
  'KismetMathLibrary:Multiply_Vector2DFloat': (T, [a, k]) => ({ X: a.X * k, Y: a.Y * k }),
  'KismetMathLibrary:Divide_FloatFloat': (T, [a, b]) => (b === 0 ? 0 : a / b),
  'KismetMathLibrary:Divide_IntInt': (T, [a, b]) => (b === 0 ? 0 : Math.trunc(a / b)),
  'KismetMathLibrary:BooleanAND': (T, [a, b]) => !!(a && b),
  'KismetMathLibrary:BooleanOR': (T, [a, b]) => !!(a || b),
  'KismetMathLibrary:Not_PreBool': (T, [a]) => !a,
  'KismetMathLibrary:EqualEqual_BoolBool': (T, [a, b]) => !!a === !!b,
  'KismetMathLibrary:EqualEqual_ByteByte': (T, [a, b]) => a === b,
  'KismetMathLibrary:EqualEqual_FloatFloat': (T, [a, b]) => a === b,
  'KismetMathLibrary:EqualEqual_IntInt': (T, [a, b]) => a === b,
  'KismetMathLibrary:EqualEqual_NameName': (T, [a, b]) => String(a).toLowerCase() === String(b).toLowerCase(),
  'KismetMathLibrary:EqualEqual_ObjectObject': (T, [a, b]) => (a ?? null) === (b ?? null),
  'KismetMathLibrary:EqualEqual_VectorVector': (T, [a, b, tol = 1e-4]) => Math.abs(a.X - b.X) <= tol && Math.abs(a.Y - b.Y) <= tol && Math.abs(a.Z - b.Z) <= tol,
  'KismetMathLibrary:NotEqual_ByteByte': (T, [a, b]) => a !== b,
  'KismetMathLibrary:NotEqual_IntInt': (T, [a, b]) => a !== b,
  'KismetMathLibrary:Greater_FloatFloat': (T, [a, b]) => a > b,
  'KismetMathLibrary:Greater_IntInt': (T, [a, b]) => a > b,
  'KismetMathLibrary:GreaterEqual_IntInt': (T, [a, b]) => a >= b,
  'KismetMathLibrary:Less_FloatFloat': (T, [a, b]) => a < b,
  'KismetMathLibrary:Less_IntInt': (T, [a, b]) => a < b,
  'KismetMathLibrary:LessEqual_FloatFloat': (T, [a, b]) => a <= b,
  'KismetMathLibrary:LessEqual_IntInt': (T, [a, b]) => a <= b,
  'KismetMathLibrary:InRange_FloatFloat': (T, [v, mn, mx, imn = true, imx = true]) => (imn ? v >= mn : v > mn) && (imx ? v <= mx : v < mx),
  'KismetMathLibrary:Clamp': (T, [v, a, b]) => clamp(v, a, b),
  'KismetMathLibrary:FClamp': (T, [v, a, b]) => clamp(v, a, b),
  'KismetMathLibrary:Max': (T, [a, b]) => Math.max(a, b),
  'KismetMathLibrary:FFloor': (T, [a]) => Math.floor(a),
  'KismetMathLibrary:FTrunc': (T, [a]) => Math.trunc(a),
  'KismetMathLibrary:Round': (T, [a]) => Math.floor(a + 0.5),
  'KismetMathLibrary:Lerp': (T, [a, b, t]) => a + (b - a) * t,
  'KismetMathLibrary:Ease': (T, [a, b, t, f, exp, steps]) => ease(a, b, t, f, exp, steps),
  'KismetMathLibrary:VLerp': (T, [a, b, t]) => V(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, a.Z + (b.Z - a.Z) * t),
  'KismetMathLibrary:RLerp': (T, [a, b, t, corto]) => {
    if (corto) return quatARot(slerp(rotAQuat(a), rotAQuat(b), t));
    return { Pitch: a.Pitch + (b.Pitch - a.Pitch) * t, Yaw: a.Yaw + (b.Yaw - a.Yaw) * t, Roll: a.Roll + (b.Roll - a.Roll) * t };
  },
  'KismetMathLibrary:LinearColorLerp': (T, [a, b, t]) => ({ R: a.R + (b.R - a.R) * t, G: a.G + (b.G - a.G) * t, B: a.B + (b.B - a.B) * t, A: a.A + (b.A - a.A) * t }),
  'KismetMathLibrary:MapRangeClamped': (T, [v, ia, ib, oa, ob]) => { const t = ib === ia ? (v >= ib ? 1 : 0) : clamp((v - ia) / (ib - ia), 0, 1); return oa + (ob - oa) * t; },
  'KismetMathLibrary:MapRangeUnclamped': (T, [v, ia, ib, oa, ob]) => { const t = ib === ia ? 0 : (v - ia) / (ib - ia); return oa + (ob - oa) * t; },
  'KismetMathLibrary:FInterpTo': (T, [c, t, dt, s]) => { if (s <= 0) return t; const d = t - c; if (d * d < 1e-8) return t; return c + d * clamp(dt * s, 0, 1); },
  'KismetMathLibrary:FInterpTo_Constant': (T, [c, t, dt, s]) => { const d = t - c; if (d * d < 1e-8) return t; const st = s * dt; return c + clamp(d, -st, st); },
  'KismetMathLibrary:TInterpTo': (T, [c, t, dt, s]) => {
    if (s <= 0) return t; const a = clamp(dt * s, 0, 1);
    return { Translation: V(c.Translation.X + (t.Translation.X - c.Translation.X) * a, c.Translation.Y + (t.Translation.Y - c.Translation.Y) * a, c.Translation.Z + (t.Translation.Z - c.Translation.Z) * a),
      Rotation: slerp(c.Rotation, t.Rotation, a), Scale3D: V(c.Scale3D.X + (t.Scale3D.X - c.Scale3D.X) * a, c.Scale3D.Y + (t.Scale3D.Y - c.Scale3D.Y) * a, c.Scale3D.Z + (t.Scale3D.Z - c.Scale3D.Z) * a) };
  },
  'KismetMathLibrary:RandomBool': () => Math.random() < 0.5,
  'KismetMathLibrary:RandomFloatInRange': (T, [a, b]) => a + Math.random() * (b - a),
  'KismetMathLibrary:RandomInteger': (T, [n]) => (n > 0 ? Math.floor(Math.random() * n) : 0),
  'KismetMathLibrary:RandomIntegerInRange': (T, [a, b]) => (b < a ? a : a + Math.floor(Math.random() * (b - a + 1))),
  'KismetMathLibrary:SelectFloat': (T, [a, b, p]) => (p ? a : b),
  'KismetMathLibrary:SelectInt': (T, [a, b, p]) => (p ? a : b),
  'KismetMathLibrary:SelectObject': (T, [a, b, p]) => (p ? a : b),
  'KismetMathLibrary:SelectString': (T, [a, b, p]) => (p ? a : b),
  'KismetMathLibrary:SelectVector': (T, [a, b, p]) => (p ? a : b),
  'KismetMathLibrary:Conv_BoolToFloat': (T, [a]) => (a ? 1 : 0),
  'KismetMathLibrary:Conv_BoolToInt': (T, [a]) => (a ? 1 : 0),
  'KismetMathLibrary:Conv_ByteToFloat': (T, [a]) => a,
  'KismetMathLibrary:Conv_ByteToInt': (T, [a]) => a,
  'KismetMathLibrary:Conv_IntToBool': (T, [a]) => a !== 0,
  'KismetMathLibrary:Conv_IntToByte': (T, [a]) => a & 255,
  'KismetMathLibrary:Conv_IntToFloat': (T, [a]) => a,
  'KismetMathLibrary:Conv_LinearColorToColor': (T, [c]) => ({ R: Math.round(clamp(c.R, 0, 1) ** (1 / 2.2) * 255), G: Math.round(clamp(c.G, 0, 1) ** (1 / 2.2) * 255), B: Math.round(clamp(c.B, 0, 1) ** (1 / 2.2) * 255), A: Math.round(clamp(c.A, 0, 1) * 255) }),
  'KismetMathLibrary:Conv_VectorToLinearColor': (T, [v]) => ({ R: v.X, G: v.Y, B: v.Z, A: 1 }),
  'KismetMathLibrary:MakeVector': (T, [x, y, z]) => V(x, y, z),
  'KismetMathLibrary:MakeVector2D': (T, [x, y]) => ({ X: x, Y: y }),
  'KismetMathLibrary:BreakVector': (T, [v], refs) => { set(refs, 1, v.X); set(refs, 2, v.Y); set(refs, 3, v.Z); },
  'KismetMathLibrary:BreakVector2D': (T, [v], refs) => { set(refs, 1, v.X); set(refs, 2, v.Y); },
  'KismetMathLibrary:MakeRotator': (T, [roll, pitch, yaw]) => ({ Pitch: pitch, Yaw: yaw, Roll: roll }),
  'KismetMathLibrary:BreakRotator': (T, [r], refs) => { set(refs, 1, r.Roll); set(refs, 2, r.Pitch); set(refs, 3, r.Yaw); },
  'KismetMathLibrary:MakeTransform': (T, [p, r, s]) => ({ Translation: { ...p }, Rotation: rotAQuat(r), Scale3D: { ...(s || V(1, 1, 1)) } }),
  'KismetMathLibrary:BreakTransform': (T, [t], refs) => { set(refs, 1, { ...t.Translation }); set(refs, 2, quatARot(t.Rotation)); set(refs, 3, { ...t.Scale3D }); },
  'KismetMathLibrary:TransformDirection': (T, [t, d]) => qrot(t.Rotation, d),
  'KismetMathLibrary:VSize': (T, [v]) => vlen(v),
  'KismetMathLibrary:VSize2D': (T, [v]) => Math.hypot(v.X, v.Y),
  'KismetMathLibrary:VSizeSquared': (T, [v]) => vdot(v, v),
  'KismetMathLibrary:Dot_VectorVector': (T, [a, b]) => vdot(a, b),
  'KismetMathLibrary:Normal': (T, [v]) => { const l = vlen(v); return l < 1e-8 ? V() : vmul(v, 1 / l); },
  'KismetMathLibrary:GetDirectionUnitVector': (T, [a, b]) => { const d = vsub(b, a), l = vlen(d); return l < 1e-8 ? V() : vmul(d, 1 / l); },
  'KismetMathLibrary:GetForwardVector': (T, [r]) => rotEjes(r).x,
  'KismetMathLibrary:GetRightVector': (T, [r]) => rotEjes(r).y,
  'KismetMathLibrary:FindLookAtRotation': (T, [a, b]) => rotDesdeX(vsub(b, a)),
  'KismetMathLibrary:ClassIsChildOf': (T, [a, b], refs, F, vm) => !!a && !!b && vm.esA(a, b.n || b.nat),
  'KismetMathLibrary:MakeTimespan': (T, [d, h, m, s, ms]) => (((d * 24 + h) * 60 + m) * 60 + s) + (ms || 0) / 1000,
  'KismetMathLibrary:BreakTimespan': (T, [ts], refs) => { const t = Math.max(0, ts || 0); set(refs, 1, Math.floor(t / 86400)); set(refs, 2, Math.floor(t / 3600) % 24); set(refs, 3, Math.floor(t / 60) % 60); set(refs, 4, Math.floor(t) % 60); set(refs, 5, Math.floor(t * 1000) % 1000); },
  // ---------------- strings / texto ----------------
  'KismetStringLibrary:Concat_StrStr': (T, [a, b]) => String(a ?? '') + String(b ?? ''),
  'KismetStringLibrary:Conv_BoolToString': (T, [a]) => (a ? 'true' : 'false'),
  'KismetStringLibrary:Conv_FloatToString': (T, [a]) => floatStr(a),
  'KismetStringLibrary:Conv_IntToString': (T, [a]) => String(a | 0),
  'KismetStringLibrary:Conv_NameToString': (T, [a]) => String(a ?? ''),
  'KismetStringLibrary:Conv_StringToName': (T, [a]) => String(a ?? ''),
  'KismetStringLibrary:Conv_StringToFloat': (T, [a]) => parseFloat(a) || 0,
  'KismetStringLibrary:Conv_StringToInt': (T, [a]) => parseInt(a, 10) || 0,
  'KismetStringLibrary:Conv_VectorToString': (T, [v]) => `X=${v.X.toFixed(3)} Y=${v.Y.toFixed(3)} Z=${v.Z.toFixed(3)}`,
  'KismetStringLibrary:Conv_Vector2dToString': (T, [v]) => `X=${v.X.toFixed(3)} Y=${v.Y.toFixed(3)}`,
  'KismetStringLibrary:Conv_RotatorToString': (T, [r]) => `P=${r.Pitch.toFixed(6)} Y=${r.Yaw.toFixed(6)} R=${r.Roll.toFixed(6)}`,
  'KismetStringLibrary:Conv_TransformToString': (T, [t]) => JSON.stringify(t),
  'KismetStringLibrary:EqualEqual_StrStr': (T, [a, b]) => String(a) === String(b),
  'KismetStringLibrary:NotEqual_StriStri': (T, [a, b]) => String(a).toLowerCase() !== String(b).toLowerCase(),
  'KismetTextLibrary:Conv_BoolToText': (T, [a]) => (a ? 'true' : 'false'),
  'KismetTextLibrary:Conv_StringToText': (T, [a]) => String(a ?? ''),
  'KismetTextLibrary:Conv_TextToString': (T, [a]) => String(a ?? ''),
  'KismetTextLibrary:Conv_IntToText': (T, [v, grp, minI = 1]) => String(Math.abs(v | 0)).padStart(minI, '0').replace(/^/, v < 0 ? '-' : ''),
  'KismetTextLibrary:Conv_FloatToText': (T, [v, modo, grp, minI = 1, maxI, minF = 0, maxF = 3]) => {
    let s = Number(v).toFixed(maxF); if (s.includes('.')) { s = s.replace(/0+$/, ''); const fr = (s.split('.')[1] || ''); if (fr.length < minF) s = Number(v).toFixed(minF); if (s.endsWith('.')) s = s.slice(0, -1); }
    let [i, f] = s.replace('-', '').split('.'); i = i.padStart(minI, '0'); return (v < 0 ? '-' : '') + i + (f ? '.' + f : '');
  },
  // ---------------- arrays ----------------
  'KismetArrayLibrary:Array_Get': (T, [a, i], refs) => { const v = a?.[i]; set(refs, 2, v); return v; },
  'KismetArrayLibrary:Array_Length': (T, [a]) => (a ? a.length : 0),
  'KismetArrayLibrary:Array_Add': (T, [a, v], refs) => { if (!a) { a = []; set(refs, 0, a); } a.push(v); return a.length - 1; },
  'KismetArrayLibrary:Array_AddUnique': (T, [a, v], refs) => { if (!a) { a = []; set(refs, 0, a); } const i = a.indexOf(v); if (i >= 0) return -1; a.push(v); return a.length - 1; },
  'KismetArrayLibrary:Array_Clear': (T, [a]) => { if (a) a.length = 0; },
  'KismetArrayLibrary:Array_Find': (T, [a, v]) => (a ? a.findIndex((x) => x === v || (x && v && typeof x === 'object' && JSON.stringify(x) === JSON.stringify(v))) : -1),
  'KismetArrayLibrary:Array_Remove': (T, [a, i]) => { if (a && i >= 0 && i < a.length) a.splice(i, 1); },
  // ---------------- sistema ----------------
  'KismetSystemLibrary:IsValid': (T, [o]) => !!o && o.vivo !== false,
  'KismetSystemLibrary:IsValidClass': (T, [c]) => !!c,
  'KismetSystemLibrary:MakeLiteralBool': (T, [a]) => !!a,
  'KismetSystemLibrary:MakeLiteralFloat': (T, [a]) => a,
  'KismetSystemLibrary:MakeLiteralInt': (T, [a]) => a,
  'KismetSystemLibrary:MakeLiteralText': (T, [a]) => a,
  'KismetSystemLibrary:PrintString': (T, [ctx, s], refs, F, vm) => { vm.mundo.depurar?.('Print', s); },
  'KismetSystemLibrary:PrintText': (T, [ctx, s], refs, F, vm) => { vm.mundo.depurar?.('Print', s); },
  'KismetSystemLibrary:GetDisplayName': (T, [o]) => (o ? o.nombre || String(o) : ''),
  'KismetSystemLibrary:DoesImplementInterface': (T, [o, i], refs, F, vm) => false,
  'KismetSystemLibrary:Delay': (T, [ctx, dur, info], refs, F, vm) => { vm.latente(info, dur, 'delay'); },
  'KismetSystemLibrary:RetriggerableDelay': (T, [ctx, dur, info], refs, F, vm) => { const a = vm.latente(info, dur, 'retrigger'); if (a) a.t = dur; },
  'KismetSystemLibrary:ExecuteConsoleCommand': (T, [ctx, cmd], refs, F, vm) => { vm.mundo.consola?.(cmd); },
  'KismetSystemLibrary:QuitGame': (T, a, refs, F, vm) => { vm.mundo.salir?.(); },
  'KismetSystemLibrary:SetObjectPropertyByName': (T, [o, n, v], refs, F, vm) => { if (o) vm.mundo.escribir(o, n, v); },
  'KismetSystemLibrary:K2_SetTimer': (T, [o, fn, t, loop], refs, F, vm) => vm.mundo.timers.poner(o, fn, t, loop),
  'KismetSystemLibrary:K2_SetTimerDelegate': (T, [d, t, loop], refs, F, vm) => (d ? vm.mundo.timers.poner(d.obj, d.fn, t, loop) : null),
  'KismetSystemLibrary:K2_ClearTimer': (T, [o, fn], refs, F, vm) => vm.mundo.timers.quitar(o, fn),
  'KismetSystemLibrary:K2_IsTimerActive': (T, [o, fn], refs, F, vm) => vm.mundo.timers.activo(o, fn),
  'KismetSystemLibrary:K2_PauseTimer': (T, [o, fn], refs, F, vm) => vm.mundo.timers.pausar(o, fn, true),
  'KismetSystemLibrary:K2_UnPauseTimer': (T, [o, fn], refs, F, vm) => vm.mundo.timers.pausar(o, fn, false),
  'KismetNodeHelperLibrary:GetValidValue': (T, [e, v]) => v,
  'KismetNodeHelperLibrary:GetEnumeratorValueFromIndex': (T, [e, i]) => i,
  'KismetNodeHelperLibrary:GetEnumeratorUserFriendlyName': (T, [e, v], refs, F, vm) => vm.mundo.nombreEnum?.(e, v) ?? String(v),
};
/* Temporizadores (K2_SetTimer): llaman a una función por nombre. */
export class Timers {
  constructor(vm) { this.vm = vm; this.lista = new Map(); }
  clave(o, fn) { return (o?.id || 0) + ':' + fn; }
  poner(o, fn, t, loop) {
    if (!o || !fn) return null;
    if (t <= 0) { this.lista.delete(this.clave(o, fn)); return null; }
    const h = { __ref: true, o, fn, t, resta: t, loop: !!loop, pausa: false };
    this.lista.set(this.clave(o, fn), h); return h;
  }
  quitar(o, fn) { this.lista.delete(this.clave(o, fn)); }
  activo(o, fn) { const h = this.lista.get(this.clave(o, fn)); return !!h && !h.pausa; }
  pausar(o, fn, p) { const h = this.lista.get(this.clave(o, fn)); if (h) h.pausa = p; }
  tick(dt, pausado) {
    for (const [k, h] of [...this.lista]) {
      if (!h.o.vivo) { this.lista.delete(k); continue; }
      if (h.pausa || (pausado && !h.o.tickEnPausa)) continue;
      h.resta -= dt;
      if (h.resta > 0) continue;
      if (h.loop) h.resta += h.t; else this.lista.delete(k);
      this.vm.llamar(h.o, h.fn, []);
    }
  }
  limpiar(o) { for (const [k, h] of [...this.lista]) if (!o || h.o === o) this.lista.delete(k); }
}
