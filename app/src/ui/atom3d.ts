// A moving 3D version of the shell model (trial: vanadium only). It shows
// exactly what the flat atom shows, with the same verified counts: protons and
// neutrons in the nucleus, electrons in their shells. Nothing new is claimed.
//
// Drawn on a 2D canvas with a hand-rolled perspective projection, so there is
// no library and no network request. Drag to turn the atom, flick
// to spin it, pinch (or wheel, or the buttons) to zoom. With reduced motion on,
// nothing moves until the reader drags it.

import type { AtomModel } from './atom';

type Vec = [number, number, number];

/** How many orbit rings a shell's electrons are spread over. */
const MAX_RINGS = 3;
const PER_RING = 4;

/**
 * Split one shell's electrons over its rings, as evenly as possible. The
 * counts always add up to the shell's verified electron count.
 */
export function ringCounts(electrons: number): number[] {
  if (electrons <= 0) return [];
  const rings = Math.min(MAX_RINGS, Math.ceil(electrons / PER_RING));
  const base = Math.floor(electrons / rings);
  const extra = electrons % rings;
  return Array.from({ length: rings }, (_, j) => base + (j < extra ? 1 : 0));
}

export interface Ring {
  shell: number;
  radius: number;
  electrons: number;
  /** Orthonormal axes of the ring's plane. */
  u: Vec;
  v: Vec;
  /** Starting angle and angular speed (radians per second). */
  phase: number;
  speed: number;
}

/** The rings for every shell, innermost first. Radii are in model units, outermost = 1. */
export function buildRings(shells: number[], innerRadius: number): Ring[] {
  const rings: Ring[] = [];
  const step = shells.length > 1 ? (1 - innerRadius) / (shells.length - 1) : 0;
  shells.forEach((count, i) => {
    const radius = shells.length > 1 ? innerRadius + step * i : Math.min(1, innerRadius + 0.3);
    const counts = ringCounts(count);
    counts.forEach((n, j) => {
      // Tilt each ring, and turn the rings of one shell evenly around the vertical axis.
      const tilt = counts.length === 1 ? 0.35 + 0.3 * (i % 3) : 1.0 + 0.12 * j;
      const turn = (Math.PI * j) / counts.length + i * 0.7;
      const u: Vec = [Math.cos(turn), 0, Math.sin(turn)];
      const v: Vec = [-Math.sin(turn) * Math.cos(tilt), Math.sin(tilt), Math.cos(turn) * Math.cos(tilt)];
      rings.push({
        shell: i,
        radius,
        electrons: n,
        u,
        v,
        phase: j * 0.9 + i * 0.4,
        // Outer shells turn more slowly; neighbours go opposite ways (as in the flat atom).
        speed: ((2 * Math.PI) / (7 + i * 4)) * ((i + j) % 2 ? -1 : 1),
      });
    });
  });
  return rings;
}

/** Interleave protons and neutrons evenly, so neither clumps on one side. */
function particleKinds(p: number, n: number): ('p' | 'n')[] {
  const out: ('p' | 'n')[] = [];
  let pi = 0;
  let ni = 0;
  while (pi < p || ni < n) {
    if (ni >= n || (pi < p && (pi + 0.5) / p <= (ni + 0.5) / n)) {
      out.push('p');
      pi++;
    } else {
      out.push('n');
      ni++;
    }
  }
  return out;
}

/**
 * Pack the nucleus into a ball: start from an even scatter, then push
 * overlapping particles apart while pulling everything to the centre.
 * Deterministic, so the atom looks the same every time.
 */
export function packNucleus(count: number, r: number): Vec[] {
  const pts: Vec[] = [];
  const ball = r * Math.cbrt(count) * 1.1;
  for (let i = 0; i < count; i++) {
    const z = 1 - 2 * ((i * Math.SQRT2) % 1);
    const a = i * 2.39996323;
    const d = ball * Math.cbrt(((i * 0.7548776662) % 1) * 0.9 + 0.1);
    const s = Math.sqrt(1 - z * z);
    pts.push([d * s * Math.cos(a), d * z, d * s * Math.sin(a)]);
  }
  const min = r * 1.8;
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < count; i++) {
      const a = pts[i]!;
      for (let j = i + 1; j < count; j++) {
        const b = pts[j]!;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const dist = Math.hypot(dx, dy, dz) || 1e-6;
        if (dist < min) {
          const push = (min - dist) / (2 * dist);
          a[0] -= dx * push; a[1] -= dy * push; a[2] -= dz * push;
          b[0] += dx * push; b[1] += dy * push; b[2] += dz * push;
        }
      }
      a[0] *= 0.97; a[1] *= 0.97; a[2] *= 0.97;
    }
  }
  return pts;
}

interface Drawable {
  z: number;
  draw: () => void;
}

const RING_SEGMENTS = 56;
const CAMERA = 3.4; // camera distance, in model units

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 5;
const IDLE_SPIN = 0.25; // radians per second: a slow turn, so the depth reads
const MAX_SPIN = 14;

export interface Atom3d {
  stop: () => void;
  /** Multiply the zoom (above 1 zooms in). */
  zoomBy: (factor: number) => void;
}

/** Start drawing on a canvas. */
export function startAtom3d(canvas: HTMLCanvasElement, m: AtomModel): Atom3d {
  const context = canvas.getContext('2d');
  if (!context) return { stop: () => {}, zoomBy: () => {} };
  const ctx: CanvasRenderingContext2D = context;

  const count = m.protons + m.neutrons;
  const pr = Math.max(0.018, 0.075 / Math.pow(count, 0.25)); // particle radius
  const nucleus = packNucleus(count, pr);
  const kinds = particleKinds(m.protons, m.neutrons);
  const nucleusRadius = nucleus.reduce((mx, p) => Math.max(mx, Math.hypot(p[0], p[1], p[2])), 0) + pr;
  const rings = buildRings(m.shells ?? [], Math.min(0.6, nucleusRadius + 0.14));
  const er = (m.shells?.length ?? 0) > 5 ? 0.022 : 0.03; // electron radius

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let yaw = 0.5;
  let pitch = 0.35;
  let time = 0;
  let last = 0;
  let frame = 0;
  let zoom = 1;
  // Spin momentum: the turning speed carries on after a flick, then eases
  // back to the slow idle turn.
  let vYaw = IDLE_SPIN;
  let vPitch = 0;
  let spinDir = 1;
  let lastMove = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0; // distance between two fingers at the last event
  let colors = readColors();

  function readColors() {
    const cs = getComputedStyle(canvas);
    const get = (name: string) => cs.getPropertyValue(name).trim();
    return {
      proton: get('--proton'),
      neutron: get('--neutron'),
      electron: get('--electron'),
      shell: get('--shell'),
      electronEdge: get('--electron-edge'),
      surface: get('--surface'),
    };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    colors = readColors();
    if (reduceMotion) draw();
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    // A point on the outermost shell projects at most CAMERA / sqrt(CAMERA^2 - 1) from the centre.
    const scale = (Math.min(w, h) * 0.5 * 0.94 * Math.sqrt(CAMERA * CAMERA - 1) * zoom) / CAMERA;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    // Rotate by yaw (around the vertical axis) then pitch, then project.
    const project = (p: Vec): [number, number, number, number] => {
      const x = p[0] * cy + p[2] * sy;
      const z0 = -p[0] * sy + p[2] * cy;
      const y = p[1] * cp - z0 * sp;
      const z = p[1] * sp + z0 * cp;
      const k = CAMERA / (CAMERA - z);
      return [w / 2 + x * k * scale, h / 2 - y * k * scale, z, k * scale];
    };
    const onRing = (r: Ring, a: number): Vec => {
      const c = Math.cos(a) * r.radius;
      const s = Math.sin(a) * r.radius;
      return [r.u[0] * c + r.v[0] * s, r.u[1] * c + r.v[1] * s, r.u[2] * c + r.v[2] * s];
    };

    const items: Drawable[] = [];
    const line = Math.max(1, (scale / zoom) * 0.006); // doesn't thicken when zoomed in

    for (const ring of rings) {
      let prev = project(onRing(ring, 0));
      for (let s = 1; s <= RING_SEGMENTS; s++) {
        const next = project(onRing(ring, (2 * Math.PI * s) / RING_SEGMENTS));
        const a = prev;
        items.push({
          z: (a[2] + next[2]) / 2,
          draw: () => {
            ctx.strokeStyle = colors.shell;
            ctx.lineWidth = line;
            if (m.predicted) ctx.setLineDash(s % 2 ? [] : [0, line * 100]); // dashed: skip every other piece
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(next[0], next[1]);
            ctx.stroke();
            ctx.setLineDash([]);
          },
        });
        prev = next;
      }
      for (let k = 0; k < ring.electrons; k++) {
        const p = project(onRing(ring, ring.phase + ring.speed * time + (2 * Math.PI * k) / ring.electrons));
        items.push({
          z: p[2] + 0.04, // just in front of its own ring, so the line never crosses it
          draw: () => {
            ctx.fillStyle = colors.electron;
            ctx.strokeStyle = colors.electronEdge;
            ctx.lineWidth = line;
            ctx.beginPath();
            ctx.arc(p[0], p[1], er * p[3], 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          },
        });
      }
    }

    nucleus.forEach((pt, i) => {
      const p = project(pt);
      const proton = kinds[i] === 'p';
      items.push({
        z: p[2],
        draw: () => {
          ctx.beginPath();
          ctx.arc(p[0], p[1], pr * p[3], 0, 2 * Math.PI);
          ctx.fillStyle = proton ? colors.proton : colors.neutron;
          ctx.fill();
          ctx.strokeStyle = colors.surface;
          ctx.lineWidth = line;
          ctx.stroke();
        },
      });
    });

    items.sort((a, b) => a.z - b.z); // far to near
    ctx.clearRect(0, 0, w, h);
    for (const item of items) item.draw();
  }

  const clampPitch = (p: number) => Math.max(-1.5, Math.min(1.5, p));

  function tick(now: number) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    time += dt;
    if (pointers.size === 0) {
      yaw += vYaw * dt;
      const p = clampPitch(pitch + vPitch * dt);
      if (p !== pitch + vPitch * dt) vPitch = 0;
      pitch = p;
      // Friction: ease toward the idle turn, in the direction of the last flick.
      vYaw += (IDLE_SPIN * spinDir - vYaw) * (1 - Math.exp(-dt * 1.1));
      vPitch *= Math.exp(-dt * 2.2);
    }
    draw();
    frame = requestAnimationFrame(tick);
  }

  function setZoom(z: number) {
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    if (reduceMotion) draw();
  }

  function pinchDistance(): number {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  function down(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    vYaw = 0;
    vPitch = 0;
    lastMove = e.timeStamp;
    pinch = pinchDistance();
  }
  function move(e: PointerEvent) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size >= 2) {
      // Two fingers: pinch to zoom.
      const d = pinchDistance();
      if (pinch > 0 && d > 0) setZoom(zoom * (d / pinch));
      pinch = d;
      vYaw = 0;
      vPitch = 0;
      return;
    }
    yaw += dx * 0.01;
    pitch = clampPitch(pitch + dy * 0.01);
    // Track the speed of the drag (smoothed), to carry on after release.
    const dt = Math.max(0.001, (e.timeStamp - lastMove) / 1000);
    lastMove = e.timeStamp;
    const cap = (v: number) => Math.max(-MAX_SPIN, Math.min(MAX_SPIN, v));
    vYaw = cap(vYaw * 0.5 + ((dx * 0.01) / dt) * 0.5);
    vPitch = cap(vPitch * 0.5 + ((dy * 0.01) / dt) * 0.5);
    if (reduceMotion) draw();
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId);
    pinch = 0;
    if (pointers.size > 0) return;
    // A finger that paused before lifting leaves the atom where it is.
    if (reduceMotion || e.timeStamp - lastMove > 90) {
      vYaw = 0;
      vPitch = 0;
    }
    if (Math.abs(vYaw) > 0.05) spinDir = Math.sign(vYaw);
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    setZoom(zoom * Math.exp(-e.deltaY * 0.0015));
  }
  function key(e: KeyboardEvent) {
    const step = 0.15;
    if (e.key === 'ArrowLeft') yaw -= step;
    else if (e.key === 'ArrowRight') yaw += step;
    else if (e.key === 'ArrowUp') pitch = clampPitch(pitch + step);
    else if (e.key === 'ArrowDown') pitch = clampPitch(pitch - step);
    else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.25);
    else if (e.key === '-') setZoom(zoom / 1.25);
    else return;
    e.preventDefault();
    if (reduceMotion) draw();
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('keydown', key);
  canvas.addEventListener('wheel', wheel, { passive: false });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  if (reduceMotion) draw();
  else frame = requestAnimationFrame(tick);

  const stop = () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('keydown', key);
    canvas.removeEventListener('wheel', wheel);
  };
  return { stop, zoomBy: (factor) => setZoom(zoom * factor) };
}

/**
 * Open the 3D atom full-screen. `legend` is the same legend the flat atom
 * uses. Closes on the Close button, Escape, or leaving the page.
 */
export function openAtom3d(m: AtomModel, title: string, legend: HTMLElement): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'atom3d';
  dialog.setAttribute('aria-label', title);

  const bar = document.createElement('div');
  bar.className = 'atom3d-bar';
  const h = document.createElement('h2');
  h.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'nav-btn';
  close.textContent = '✕ Close';
  const zoomButton = (text: string, label: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nav-btn';
    b.textContent = text;
    b.setAttribute('aria-label', label);
    return b;
  };
  const zoomOut = zoomButton('−', 'Zoom out');
  const zoomIn = zoomButton('+', 'Zoom in');
  bar.append(h, zoomOut, zoomIn, close);

  const canvas = document.createElement('canvas');
  canvas.className = 'atom3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${m.label} Shown in 3D. Drag, or use the arrow keys, to turn it. Pinch, or use the plus and minus keys, to zoom.`);

  const foot = document.createElement('div');
  foot.className = 'atom3d-foot';
  const hint = document.createElement('p');
  hint.className = 'atom-caption';
  hint.textContent = 'Drag to turn the atom, flick to spin it, pinch or use − and + to zoom. This is the same shell model as the flat picture, with each shell’s electrons spread over tilted rings.';
  foot.append(legend, hint);

  dialog.append(bar, canvas, foot);
  document.body.append(dialog);
  dialog.showModal();
  const view = startAtom3d(canvas, m);
  zoomOut.addEventListener('click', () => view.zoomBy(1 / 1.4));
  zoomIn.addEventListener('click', () => view.zoomBy(1.4));

  const shut = () => dialog.close();
  close.addEventListener('click', shut);
  window.addEventListener('hashchange', shut, { once: true });
  dialog.addEventListener('close', () => {
    view.stop();
    window.removeEventListener('hashchange', shut);
    dialog.remove();
  });
}
