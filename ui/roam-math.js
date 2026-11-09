// Geometry for the roaming mascot. No DOM: rects in, page coordinates out.

export const THROW_SPEED = 1600; // px/s; a release faster than this is a throw, not a drop
export const HOP_MS = 600;

// Where the mascot's box goes for a perch on an element.
// rect: element's page rect {left, top, width, height}. size: {w, h} of the mascot.
// perch: { mode: "sit" | "peek", side: "top" | "left" | "right" | "bottom", align: 0..1 }
// -> { x, y, rot, layer: "front" | "back" }   (x, y = mascot box top-left)
export function perchPosition(rect, perch, size) {
    const align = perch.align ?? 0.5;
    const { w, h } = size;
    if (perch.mode === "sit") {
        // bottom of the mascot rests on the element's top edge (slight overlap reads as sitting)
        return { x: rect.left + align * rect.width - w / 2, y: rect.top - h * 0.9, rot: 0, layer: "front" };
    }
    // peek: tucked behind an edge, about half showing
    const side = perch.side || "right";
    if (side === "top") return { x: rect.left + align * rect.width - w / 2, y: rect.top - h * 0.55, rot: 0, layer: "back" };
    if (side === "bottom") return { x: rect.left + align * rect.width - w / 2, y: rect.top + rect.height - h * 0.45, rot: 12, layer: "back" };
    if (side === "left") return { x: rect.left - w * 0.55, y: rect.top + align * rect.height - h / 2, rot: 12, layer: "back" };
    return { x: rect.left + rect.width - w * 0.45, y: rect.top + align * rect.height - h / 2, rot: -12, layer: "back" };
}

// Points along a hop. Long trips split into several smaller bounces.
export function hopPath(from, to, steps = 12) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const bounces = dist > 700 ? 3 : dist > 380 ? 2 : 1;
    const points = [];
    for (let b = 0; b < bounces; b++) {
        const a = { x: from.x + ((to.x - from.x) * b) / bounces, y: from.y + ((to.y - from.y) * b) / bounces };
        const z = { x: from.x + ((to.x - from.x) * (b + 1)) / bounces, y: from.y + ((to.y - from.y) * (b + 1)) / bounces };
        const height = Math.min(140, 50 + (dist / bounces) * 0.3);
        for (let i = b === 0 ? 0 : 1; i <= steps; i++) {
            const t = i / steps;
            points.push({ x: a.x + (z.x - a.x) * t, y: a.y + (z.y - a.y) * t - height * 4 * t * (1 - t) });
        }
    }
    return { points, bounces, duration: HOP_MS * (bounces === 1 ? 1 : 0.75 * bounces) };
}

const center = (p, size) => ({ x: p.x + size.w / 2, y: p.y + size.h / 2 });

export function nearestIndex(positions, point, size) {
    let best = -1;
    let bestD = Infinity;
    positions.forEach((p, i) => {
        const c = center(p, size);
        const d = Math.hypot(c.x - point.x, c.y - point.y);
        if (d < bestD) { bestD = d; best = i; }
    });
    return best;
}

export function farthestIndex(positions, point, size) {
    let best = -1;
    let bestD = -1;
    positions.forEach((p, i) => {
        const c = center(p, size);
        const d = Math.hypot(c.x - point.x, c.y - point.y);
        if (d > bestD) { bestD = d; best = i; }
    });
    return best;
}

// Release velocity from recent pointer samples [{x, y, t}] (ms). Uses the last ~100ms.
export function releaseVelocity(samples) {
    if (samples.length < 2) return { vx: 0, vy: 0, speed: 0 };
    const last = samples[samples.length - 1];
    let first = samples[0];
    for (const s of samples) if (last.t - s.t <= 100) { first = s; break; }
    const dt = Math.max(1, last.t - first.t) / 1000;
    const vx = (last.x - first.x) / dt;
    const vy = (last.y - first.y) / dt;
    return { vx, vy, speed: Math.hypot(vx, vy) };
}

// Which side of the mascot the bubble opens on, given free room around it.
export function bubbleSide(box, viewport, bubble) {
    const room = {
        left: box.x - viewport.left,
        right: viewport.left + viewport.width - (box.x + box.w),
        top: box.y - viewport.top
    };
    if (room.left >= bubble.w + 16) return "left";
    if (room.right >= bubble.w + 16) return "right";
    if (room.top >= bubble.h + 16) return "top";
    return room.left >= room.right ? "left" : "right";
}
