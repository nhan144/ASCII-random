import { useEffect, useRef } from "react";
import { buildRoseScene, genRose } from "./scene.js";

// character bands, light -> dense. Each cell picks one at random and re-rolls ~3x/sec (the shimmer)
const BANDS = [".`'", ",:;-_", "~+=/\\|", "()<>{}[]", "rcztxjvu", "fnoeaw1l", "0QO#%", "B8&$@"];
const LEVELS = 24, D = 4, TILT = 0.3;
const CLASSES = {
  0: { h: 354, s: 72, a: 10, b: 66 },  // rose
  4: { h: 128, s: 58, a: 9, b: 56 },   // leaves
  5: { h: 135, s: 50, a: 9, b: 52 },   // stem
  6: { h: 8, s: 55, a: 10, b: 45 },    // thorns
};
const PAL = {};
for (const [k, c] of Object.entries(CLASSES)) PAL[k] = Array.from({ length: LEVELS }, (_, i) => `hsl(${c.h} ${c.s}% ${c.a + ((c.b - c.a) * i) / (LEVELS - 1)}%)`);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mul3 = (A, B) => { const o = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o.push(A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]); return o; };
const MONO = `"DejaVu Sans Mono", ui-monospace, Menlo, Consolas, monospace`;

export default function SpinningRose({ density, speed, replayKey, canvasRef, handle }) {
  const o = useRef({}); o.current = { density, speed, replayKey, handle };

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext("2d"), items = buildRoseScene(), rose = items[0];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf, w, h, dpr, cs, cw, ch, cols, rows, depth, br, cl, stars = [], dust = [], laid = 0;
    let angle = 0, start = performance.now(), last = start, lastKey = o.current.replayKey, lastBloom = -1, fps = 60;

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      laid = o.current.density;
      cs = Math.max(4, Math.round(Math.min(w * 1.3, h) / (115 * laid))); cw = cs * 0.6; ch = cs;
      cols = Math.ceil(w / cw); rows = Math.ceil(h / ch);
      depth = new Float32Array(cols * rows); br = new Float32Array(cols * rows); cl = new Uint8Array(cols * rows);
      const rnd = (n) => (Math.random() * n) | 0;
      stars = Array.from({ length: Math.floor((w * h) / 26000) }, () => ({ c: rnd(cols), r: rnd(rows), size: 3 + rnd(7), ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 1.4 }));
      dust = Array.from({ length: Math.floor((w * h) / 1600) }, () => ({ c: rnd(cols), r: rnd(rows), ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 2, ch: "..+*"[rnd(4)] }));
    }
    layout();
    const ro = new ResizeObserver(layout); ro.observe(canvas);

    function frame(now) {
      const op = o.current;
      if (op.density !== laid) layout();
      if (op.replayKey !== lastKey) { lastKey = op.replayKey; start = now; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
      const t = (now - start) / 1000;
      if (!reduce) angle += dt * op.speed;

      // bloom: bud -> full rose
      const x = clamp((t - 0.6) / 6, 0, 1), b01 = 1 - Math.pow(1 - x, 3), bloom = 0.18 + 0.82 * b01;
      if (Math.abs(bloom - lastBloom) > 0.003) { genRose(bloom, rose.pos, rose.nrm); lastBloom = bloom; }
      const sf = 0.45 + 0.55 * b01; rose.sf = sf; rose.center[1] = 0.1 + 0.409 * sf;

      const cy_ = Math.cos(angle), sy_ = Math.sin(angle), ct = Math.cos(TILT), st = Math.sin(TILT);
      const Rm = mul3([1, 0, 0, 0, ct, -st, 0, st, ct], [cy_, 0, sy_, 0, 1, 0, -sy_, 0, cy_]);
      const S = Math.min(w * 0.42, h * 0.335), CX = w / 2, CYc = h * 0.47 - 0.32 * S;
      depth.fill(-Infinity);
      let filled = 0;

      for (const it of items) {
        const G = mul3(Rm, it.M), c = it.center, s = it.scale * (it.sf || 1), pos = it.pos, nrm = it.nrm, ao = it.ao;
        const tx = Rm[0] * c[0] + Rm[1] * c[1] + Rm[2] * c[2], ty = Rm[3] * c[0] + Rm[4] * c[1] + Rm[5] * c[2], tz = Rm[6] * c[0] + Rm[7] * c[1] + Rm[8] * c[2];
        for (let k = 0, p = 0; k < it.n; k++, p += 3) {
          const lx = pos[p], ly = pos[p + 1], lz = pos[p + 2];
          const wx = tx + s * (G[0] * lx + G[1] * ly + G[2] * lz), wy = ty + s * (G[3] * lx + G[4] * ly + G[5] * lz), wz = tz + s * (G[6] * lx + G[7] * ly + G[8] * lz);
          const f = D / (D - wz), col = ((CX + wx * S * f) / cw) | 0, row = ((CYc - wy * S * f) / ch) | 0;
          if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
          const idx = row * cols + col;
          if (wz <= depth[idx]) continue;
          const mx = nrm[p], my = nrm[p + 1], mz = nrm[p + 2];
          let nx = G[0] * mx + G[1] * my + G[2] * mz, ny = G[3] * mx + G[4] * my + G[5] * mz, nz = G[6] * mx + G[7] * my + G[8] * mz;
          if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
          const a = ao[k], diff = Math.max(0, -0.45 * nx + 0.65 * ny + 0.62 * nz);
          const bright = (0.08 + 0.66 * diff * a + 0.2 * a + 0.1 * (1 - nz)) * (0.78 + 0.22 * clamp((wz + 1) / 2, 0, 1));
          depth[idx] = wz; br[idx] = clamp(bright, 0, 1); cl[idx] = it.cls;
        }
      }

      // ---- draw ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
      ctx.font = `${cs}px ${MONO}`; ctx.textBaseline = "top"; ctx.fillStyle = "#dfe6ff";
      const fade = Math.min(1, t / 1.2);
      for (const d of dust) { const tw = 0.5 + 0.5 * Math.sin(t * d.sp + d.ph); if (tw < 0.35) continue; ctx.globalAlpha = fade * tw * 0.6; ctx.fillText(d.ch, d.c * cw, d.r * ch); }
      for (const s of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph), n = Math.round(s.size * tw);
        ctx.globalAlpha = fade * (0.3 + 0.7 * tw); ctx.fillText(s.size > 6 ? "*" : "+", s.c * cw, s.r * ch);
        for (let k = 1; k <= n; k++) {
          ctx.globalAlpha = fade * tw * (1 - k / (n + 1)) * 0.85;
          ctx.fillText("|", s.c * cw, (s.r + k) * ch); ctx.fillText("|", s.c * cw, (s.r - k) * ch);
          if (k % 2 === 0) { ctx.fillText("-", (s.c + k * 2) * cw, s.r * ch); ctx.fillText("-", (s.c - k * 2) * cw, s.r * ch); }
          if (s.size > 5 && k <= n - 2) { ctx.fillText("/", (s.c + k) * cw, (s.r - k) * ch); ctx.fillText("/", (s.c - k) * cw, (s.r + k) * ch); ctx.fillText("\\", (s.c + k) * cw, (s.r + k) * ch); ctx.fillText("\\", (s.c - k) * cw, (s.r - k) * ch); }
        }
      }
      ctx.globalAlpha = 1;
      const step = Math.floor(now / 330);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (depth[idx] === -Infinity) continue;
        filled++;
        const b = br[idx], hsh = (Math.imul(c, 73856093) ^ Math.imul(r, 19349663) ^ Math.imul(step, 83492791)) >>> 0;
        const band = BANDS[clamp(Math.floor(b * BANDS.length + ((hsh >> 8) % 3 === 0 ? (hsh % 2 ? 1 : -1) * 0.5 : 0)), 0, BANDS.length - 1)];
        ctx.fillStyle = PAL[cl[idx]][Math.min(LEVELS - 1, (b * LEVELS) | 0)];
        ctx.fillText(band[hsh % band.length], c * cw, r * ch);
      }

      // ---- HUD ----
      ctx.textBaseline = "alphabetic"; ctx.font = `13px ${MONO}`;
      ctx.textAlign = "right"; ctx.fillStyle = "#ff8fb3"; ctx.fillText(`● t ${t.toFixed(2)}s`, w - 20, 26);
      ctx.textAlign = "left"; ctx.fillStyle = "rgba(205,205,205,.75)";
      ctx.fillText(`${op.handle} · 2026`, 24, h - 98);
      ctx.fillText(`bloom ${(b01 * 100).toFixed(1)}%   sway ${(((angle * 180) / Math.PI) % 360).toFixed(2)}°`, 24, h - 78);
      ctx.fillText(`letters ${filled.toLocaleString()}`, 24, h - 58);
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(16, h - 42, w - 32, 1);
      ctx.fillStyle = "rgba(205,205,205,.85)"; ctx.fillText("$ npm run dev", 16, h - 20);
      ctx.textAlign = "right"; ctx.fillText(`running · ${Math.round(fps)} fps`, w - 16, h - 20);
      ctx.textAlign = "left";
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="stage" />;
}
