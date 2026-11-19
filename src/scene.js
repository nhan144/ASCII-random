// Geometry: one detailed rose + calyx + thorny stem + veined leaves.
// Every item is a grid of points with normals so each character can be lit.
const TAU = Math.PI * 2;
const NT = 420, NX = 56;                         // rose grid: spiral steps x height steps
const T0 = -2 * Math.PI, T1 = 15 * Math.PI;

const THETA = new Float32Array(NT), WI = new Float32Array(NT);
const XJ = new Float32Array(NX), YP = new Float32Array(NX);
const AO_ROSE = new Float32Array(NT * NX);
for (let i = 0; i < NT; i++) {
  const th = T0 + ((T1 - T0) * i) / (NT - 1);
  THETA[i] = th;
  let m = (3.6 * th) % TAU; if (m < 0) m += TAU;
  const q = 1.25 * Math.pow(1 - m / Math.PI, 2) - 0.25;
  WI[i] = 1 - 0.5 * q * q;                        // petal wave 0.5..1
}
for (let j = 0; j < NX; j++) { const x = j / (NX - 1); XJ[j] = x; YP[j] = 1.95653 * x * x * Math.pow(1.27689 * x - 1, 2); }
for (let i = 0; i < NT; i++) for (let j = 0; j < NX; j++) {
  const w01 = (WI[i] - 0.5) * 2, f = j / (NX - 1);
  // petal edges catch light, folds and the heart of the rose stay dark
  AO_ROSE[i * NX + j] = (0.28 + 0.72 * Math.pow(w01, 0.8)) * (0.4 + 0.6 * f) * (0.85 + 0.15 * Math.sin(j * 0.9 + i * 0.2));
}

function fillRose(bloom, pos) {
  for (let i = 0; i < NT; i++) {
    const phi = (Math.PI / 2) * Math.exp(-THETA[i] / (8 * Math.PI)) * bloom;
    const sp = Math.sin(phi), cp = Math.cos(phi), st = Math.sin(THETA[i]), ct = Math.cos(THETA[i]), w = WI[i];
    for (let j = 0; j < NX; j++) {
      const x = XJ[j], y = YP[j] * sp, r = w * (x * sp + y * cp), z = w * (x * cp - y * sp), k = (i * NX + j) * 3;
      pos[k] = r * st; pos[k + 1] = z; pos[k + 2] = r * ct;
    }
  }
}
let CY = 0, MAXR = 1;
(() => {
  const tmp = new Float32Array(NT * NX * 3); fillRose(1, tmp);
  let mn = Infinity, mx = -Infinity;
  for (let k = 1; k < tmp.length; k += 3) { mn = Math.min(mn, tmp[k]); mx = Math.max(mx, tmp[k]); }
  CY = (mn + mx) / 2;
  for (let k = 0; k < tmp.length; k += 3) MAXR = Math.max(MAXR, Math.hypot(tmp[k], tmp[k + 1] - CY, tmp[k + 2]));
})();

function gridNormals(pos, nrm, NU, NV) {
  for (let i = 0; i < NU; i++) {
    const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, NU - 1);
    for (let j = 0; j < NV; j++) {
      const j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, NV - 1);
      const a = (i1 * NV + j) * 3, b = (i0 * NV + j) * 3, c = (i * NV + j1) * 3, d = (i * NV + j0) * 3;
      const ux = pos[a] - pos[b], uy = pos[a + 1] - pos[b + 1], uz = pos[a + 2] - pos[b + 2];
      const vx = pos[c] - pos[d], vy = pos[c + 1] - pos[d + 1], vz = pos[c + 2] - pos[d + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1, k = (i * NV + j) * 3;
      nrm[k] = nx / l; nrm[k + 1] = ny / l; nrm[k + 2] = nz / l;
    }
  }
}

export function genRose(bloom, pos, nrm) {
  fillRose(bloom, pos);
  for (let k = 0; k < pos.length; k += 3) { pos[k] /= MAXR; pos[k + 1] = (pos[k + 1] - CY) / MAXR; pos[k + 2] /= MAXR; }
  gridNormals(pos, nrm, NT, NX);
}

const norm3 = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function basis(a, roll = 0) {                      // columns: local x, local y (= a), local z
  const ref = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const b = norm3(cross(a, ref)), c = cross(a, b), cr = Math.cos(roll), sr = Math.sin(roll);
  const b2 = b.map((v, i) => v * cr + c[i] * sr), c2 = b.map((v, i) => -v * sr + c[i] * cr);
  return [b2[0], a[0], c2[0], b2[1], a[1], c2[1], b2[2], a[2], c2[2]];
}
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function leaf({ center, dir, scale, roll = 0, width = 1.1, curl = 0.25, cls = 4, veins = true }) {
  const NU = 40, NV = 17, pos = new Float32Array(NU * NV * 3), nrm = new Float32Array(NU * NV * 3), ao = new Float32Array(NU * NV);
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const u = i / (NU - 1), v = (j / (NV - 1)) * 2 - 1, wd = 0.5 * Math.sin(Math.PI * Math.pow(u, 0.7)), k = (i * NV + j) * 3;
    pos[k] = v * wd * width; pos[k + 1] = u; pos[k + 2] = -curl * u * u - 0.22 * v * v * wd;
    const vein = Math.abs(Math.sin((u * 9 - Math.abs(v) * 2.4) * Math.PI)) < 0.16 && Math.abs(v) > 0.12;
    ao[i * NV + j] = Math.abs(v) < 0.09 ? 1 : (veins && vein ? 0.95 : 0.5 + 0.35 * u) * (1 - 0.25 * Math.abs(v));
  }
  gridNormals(pos, nrm, NU, NV);
  return { kind: "leaf", n: NU * NV, pos, nrm, ao, cls, center, scale, M: basis(norm3(dir), roll) };
}

function thorn(center, dir, scale) {
  const NU = 7, NV = 8, pos = new Float32Array(NU * NV * 3), nrm = new Float32Array(NU * NV * 3), ao = new Float32Array(NU * NV).fill(0.9);
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const u = i / (NU - 1), an = (j / NV) * TAU, r = 0.28 * (1 - u) ** 1.3, k = (i * NV + j) * 3;
    pos[k] = Math.cos(an) * r; pos[k + 1] = u; pos[k + 2] = Math.sin(an) * r;
    const n = norm3([Math.cos(an), 0.35, Math.sin(an)]); nrm[k] = n[0]; nrm[k + 1] = n[1]; nrm[k + 2] = n[2];
  }
  return { kind: "thorn", n: NU * NV, pos, nrm, ao, cls: 6, center, scale, M: basis(norm3(dir)) };
}

export function buildRoseScene() {
  const items = [];
  const rose = { kind: "rose", n: NT * NX, pos: new Float32Array(NT * NX * 3), nrm: new Float32Array(NT * NX * 3), ao: AO_ROSE, cls: 0, center: [0, 0.5, 0], scale: 0.62, M: I3, sf: 1 };
  genRose(1, rose.pos, rose.nrm);
  items.push(rose);

  // calyx (green sepals) under the flower
  for (let m = 0; m < 5; m++) {
    const a = (m / 5) * TAU + 0.3;
    items.push(leaf({ center: [Math.cos(a) * 0.05, 0.1, Math.sin(a) * 0.05], dir: [Math.cos(a) * 0.9, -0.55, Math.sin(a) * 0.9], scale: 0.3, roll: a, width: 0.55, curl: -0.15, veins: false }));
  }
  // leaves
  items.push(leaf({ center: [0.03, -0.5, 0], dir: [0.9, 0.5, 0.15], scale: 0.7, roll: 0.3 }));
  items.push(leaf({ center: [-0.03, -0.95, 0], dir: [-0.9, 0.42, -0.1], scale: 0.62, roll: 0.2 }));
  items.push(leaf({ center: [0.03, -1.25, 0], dir: [0.6, 0.55, -0.7], scale: 0.4, roll: 0.1 }));
  // thorns
  [[-0.3, 0], [-0.62, 2.1], [-0.8, 4.2], [-1.1, 1.0], [-0.42, 3.5]].forEach(([y, a]) =>
    items.push(thorn([Math.cos(a) * 0.04, y, Math.sin(a) * 0.04], [Math.cos(a), 0.45, Math.sin(a)], 0.12)));

  // stem
  const NL = 90, NA = 24, pos = new Float32Array(NL * NA * 3), nrm = new Float32Array(NL * NA * 3), ao = new Float32Array(NL * NA);
  for (let i = 0; i < NL; i++) for (let j = 0; j < NA; j++) {
    const t = i / (NL - 1), an = (j / NA) * TAU, k = (i * NA + j) * 3, bend = 0.03 * Math.sin(t * 5);
    pos[k] = Math.cos(an) * 0.045 + bend; pos[k + 1] = 0.2 - 1.75 * t; pos[k + 2] = Math.sin(an) * 0.045;
    nrm[k] = Math.cos(an); nrm[k + 1] = 0; nrm[k + 2] = Math.sin(an);
    ao[i * NA + j] = 0.55 + 0.45 * Math.abs(Math.sin(j * 1.7 + t * 6));
  }
  items.push({ kind: "stem", n: NL * NA, pos, nrm, ao, cls: 5, center: [0, 0, 0], scale: 1, M: I3 });
  return items;
}
