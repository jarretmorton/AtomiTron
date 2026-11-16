// A turnable 3D ball-and-stick model on a 2D canvas: molecules from PubChem's
// computed conformers, or a small crystal of ions. Same approach as the 3D
// atom (atom3d.ts): a hand-rolled perspective projection, no library, no
// network. Drag to turn it; it turns slowly on its own unless reduced motion
// is on. Every ball carries its element's symbol, so color never carries the
// meaning alone.

export type Vec = [number, number, number];

export interface Ball {
  label: string;
  pos: Vec;
  /** A CSS color or custom property name, e.g. 'var(--el-o)'. */
  color: string;
  /** Radius in model units. */
  r: number;
}

export interface Stick {
  a: number;
  b: number;
  /** 1, 2 or 3 lines; 0 for a faint guide line (crystal neighbors). */
  order: number;
}

const IDLE_SPIN = 0.35; // radians per second

function resolveColor(canvas: HTMLCanvasElement, c: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(c);
  return m ? getComputedStyle(canvas).getPropertyValue(m[1]!).trim() || '#888' : c;
}

/** Points re-expressed along their own largest spreads: x widest, then y, then z. */
export function facing(pts: Vec[]): Vec[] {
  const cov = [0, 1, 2].map((i) => [0, 1, 2].map((j) => pts.reduce((s, p) => s + p[i]! * p[j]!, 0)));
  const mul = (v: number[]) => [0, 1, 2].map((i) => cov[i]!.reduce((s, x, j) => s + x * v[j]!, 0));
  const norm = (v: number[]) => {
    const l = Math.hypot(...v);
    return l > 1e-9 ? v.map((x) => x / l) : null;
  };
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
  let u = norm([1, 0.3, 0.2])!;
  for (let k = 0; k < 80; k++) u = norm(mul(u)) ?? u;
  let v = norm([0.2, 1, 0.3].map((x, i) => x - dot([0.2, 1, 0.3], u) * u[i]!))!;
  for (let k = 0; k < 80; k++) {
    const m = mul(v);
    const d = dot(m, u);
    v = norm(m.map((x, i) => x - d * u[i]!)) ?? v; // a straight molecule keeps any direction across
  }
  const w = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
  return pts.map((p) => [dot(p, u), dot(p, v), dot(p, w)] as Vec);
}

/** Starts drawing; stops by itself once the canvas leaves the page. */
export function startModel3d(canvas: HTMLCanvasElement, balls: Ball[], sticks: Stick[]): void {
  const context = canvas.getContext('2d');
  if (!context || !balls.length) return;
  const ctx: CanvasRenderingContext2D = context;

  // Centre the model, and turn it so its widest side faces the viewer at
  // the start: otherwise an atom can begin hidden behind another (water's
  // second hydrogen behind its oxygen).
  const c: Vec = [0, 1, 2].map((k) => balls.reduce((s, b) => s + b.pos[k]!, 0) / balls.length) as Vec;
  const pts = facing(balls.map((b) => [b.pos[0] - c[0], b.pos[1] - c[1], b.pos[2] - c[2]] as Vec));
  const extent = Math.max(0.5, ...pts.map((p, i) => Math.hypot(...p) + balls[i]!.r));
  const camera = extent * 4;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let yaw = 0.35; // a slight turn, so it reads as 3D
  let pitch = 0.2;
  let dragging: { x: number; y: number } | null = null;
  let last = 0;
  let colors: string[] = [];
  let ink = '#000';
  let rule = '#999';

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    colors = balls.map((b) => resolveColor(canvas, b.color));
    const cs = getComputedStyle(canvas);
    ink = cs.getPropertyValue('--ink').trim() || '#000';
    rule = cs.getPropertyValue('--muted').trim() || '#999';
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const scale = (Math.min(w, h) * 0.4) / extent;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const proj = pts.map((p) => {
      const x = p[0] * cy + p[2] * sy;
      const z0 = -p[0] * sy + p[2] * cy;
      const y = p[1] * cp - z0 * sp;
      const z = p[1] * sp + z0 * cp;
      const k = camera / (camera - z);
      return { x: w / 2 + x * k * scale, y: h / 2 - y * k * scale, z, k: k * scale };
    });
    const items: { z: number; draw: () => void }[] = [];
    const lw = Math.max(1.5, scale * 0.06);
    for (const s of sticks) {
      const a = proj[s.a]!;
      const b = proj[s.b]!;
      items.push({
        z: (a.z + b.z) / 2 - 0.01,
        draw: () => {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          // From the surface of one ball to the surface of the other.
          const ra = s.order === 0 ? 0 : (balls[s.a]!.r * a.k) / len;
          const rb = s.order === 0 ? 0 : (balls[s.b]!.r * b.k) / len;
          if (ra + rb >= 1) return; // one ball hides the other: nothing between them shows
          const ax = a.x + dx * ra;
          const ay = a.y + dy * ra;
          const bx = b.x - dx * rb;
          const by = b.y - dy * rb;
          ctx.strokeStyle = s.order === 0 ? rule : ink;
          ctx.globalAlpha = s.order === 0 ? 0.35 : 1;
          ctx.lineWidth = s.order === 0 ? 1 : lw;
          const n = Math.max(1, s.order);
          const gap = lw * 1.9;
          for (let i = 0; i < n; i++) {
            const off = (i - (n - 1) / 2) * gap;
            ctx.beginPath();
            ctx.moveTo(ax + nx * off, ay + ny * off);
            ctx.lineTo(bx + nx * off, by + ny * off);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        },
      });
    }
    balls.forEach((ball, i) => {
      const p = proj[i]!;
      items.push({
        z: p.z,
        draw: () => {
          const r = ball.r * p.k;
          const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.25, colors[i]!);
          g.addColorStop(1, colors[i]!);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = ink;
          ctx.lineWidth = Math.max(1, lw * 0.35);
          ctx.stroke();
          ctx.fillStyle = '#111';
          ctx.font = `700 ${Math.max(10, r * 0.8).toFixed(0)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ball.label, p.x, p.y + 1);
        },
      });
    });
    items.sort((a, b) => a.z - b.z);
    ctx.clearRect(0, 0, w, h);
    for (const it of items) it.draw();
  }

  function tick(now: number) {
    if (!canvas.isConnected) return; // the page moved on
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    // Nothing to draw while it's out of sight (inside a closed layer).
    if (canvas.clientWidth === 0) {
      requestAnimationFrame(tick);
      return;
    }
    if (!dragging && !reduceMotion) yaw += IDLE_SPIN * dt;
    draw();
    requestAnimationFrame(tick);
  }

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - dragging.x) * 0.01;
    pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - dragging.y) * 0.01));
    dragging = { x: e.clientX, y: e.clientY };
    if (reduceMotion) draw();
  });
  const end = () => (dragging = null);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  new ResizeObserver(() => {
    resize();
    draw();
  }).observe(canvas);
  resize();
  requestAnimationFrame(tick);
}
