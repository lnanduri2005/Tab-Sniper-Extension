// Cannon into basket: land N shots in a row in a moving basket. A miss resets the streak.
// World coordinates are y-up with the ground at y = 0, units in px and seconds.
import { el } from "./ui.js";

export const STREAK = { full: 4, mini: 2 };
export const WORLD = { width: 480, height: 260 };
export const MUZZLE_SPEED = 600;
export const PIVOT = { x: 44, y: 24 };
export const BARREL_LENGTH = 34;
export const ANGLE_RANGE = { min: 20, max: 80, speed: 55 }; // degrees, degrees/sec
export const BASKET = { width: 44, height: 36, minX: 210, maxX: 450, speed: 70 };
export const BALL_RADIUS = 5;

export function launch(angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
        x: PIVOT.x + Math.cos(rad) * BARREL_LENGTH,
        y: PIVOT.y + Math.sin(rad) * BARREL_LENGTH,
        vx: Math.cos(rad) * MUZZLE_SPEED,
        vy: Math.sin(rad) * MUZZLE_SPEED
    };
}

export function stepBall(ball, gravity, dt) {
    const vy = ball.vy - gravity * dt;
    return { x: ball.x + ball.vx * dt, y: ball.y + ball.vy * dt, vx: ball.vx, vy };
}

// True when the ball passes down through the basket's open top between two steps.
export function crossesBasketTop(prev, next, basketX) {
    const top = BASKET.height;
    if (!(prev.y >= top && next.y < top)) return false;
    const t = (prev.y - top) / (prev.y - next.y);
    const x = prev.x + (next.x - prev.x) * t;
    const half = BASKET.width / 2 - BALL_RADIUS;
    return x >= basketX - half && x <= basketX + half;
}

export function isOut(ball) {
    return ball.y < 0 || ball.x > WORLD.width + 20 || ball.x < -20;
}

// Ping-pong a value between min and max.
export function oscillate(value, dir, speed, min, max, dt) {
    let next = value + dir * speed * dt;
    let nextDir = dir;
    if (next >= max) { next = max; nextDir = -1; }
    if (next <= min) { next = min; nextDir = 1; }
    return { value: next, dir: nextDir };
}

function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export function mount(root, { mini, onComplete, onEvent = () => {}, rng = Math.random }) {
    const needed = mini ? STREAK.mini : STREAK.full;
    const gravity = 760 + rng() * 140;
    const css = getComputedStyle(document.documentElement);
    const C = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const ink = C("--m-ink", "#221f29");
    const pal = { ink, screen: C("--m-screen", "#3a3743"), frame: C("--m-frame", "#c9c3d6"), cream: C("--m-cream", "#f2e8ca"), blush: C("--m-blush", "#ee93ab"), slate: C("--m-slate", "#5c6688"), ground: C("--surface", "#474452") };

    let angle = { value: 45, dir: 1 };
    let basket = { value: BASKET.minX + rng() * (BASKET.maxX - BASKET.minX), dir: rng() < 0.5 ? -1 : 1 };
    let ball = null;
    let streak = 0;
    let best = 0;
    let shots = 0;
    let done = false;
    let last = performance.now();

    const canvas = el("canvas", { class: "cannon-canvas", width: String(WORLD.width), height: String(WORLD.height), tabindex: "0" });
    const ctx = canvas.getContext("2d");
    const progress = el("div", { class: "challenge-progress" });
    const status = el("div", { class: "challenge-status" });

    function render() {
        progress.textContent = `Streak ${streak} / ${needed} · best ${best} · shots ${shots}`;
    }

    function fire() {
        if (ball || done) return;
        shots += 1;
        ball = launch(angle.value);
        render();
    }

    function resolveShot(hit) {
        ball = null;
        if (hit) {
            streak += 1;
            best = Math.max(best, streak);
            status.textContent = streak >= needed ? "" : "In!";
            onEvent("progress", streak / needed);
            if (streak >= needed) {
                done = true;
                render();
                onComplete();
                return;
            }
        } else {
            if (streak > 0) status.textContent = "Miss. Streak reset.";
            else status.textContent = "Miss.";
            onEvent("mistake");
            streak = 0;
        }
        render();
    }

    const sy = (y) => WORLD.height - y;

    function draw() {
        ctx.clearRect(0, 0, WORLD.width, WORLD.height);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // ground
        ctx.fillStyle = pal.ground;
        ctx.fillRect(0, WORLD.height - 6, WORLD.width, 6);

        // basket: a cream tub with an ink outline and a slate band
        const bx = basket.value - BASKET.width / 2;
        const by = sy(BASKET.height);
        ctx.lineWidth = 3;
        ctx.strokeStyle = pal.ink;
        ctx.fillStyle = pal.slate;
        rr(ctx, bx + 3, by + 6, BASKET.width - 6, BASKET.height - 6, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = pal.cream;
        rr(ctx, bx - 2, by - 2, BASKET.width + 4, 11, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = pal.blush;
        ctx.beginPath(); ctx.ellipse(bx + 12, by + 22, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(bx + BASKET.width - 12, by + 22, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();

        // cannon: charcoal barrel with a frame-colored muzzle ring, sitting on a base
        ctx.save();
        ctx.translate(PIVOT.x, sy(PIVOT.y));
        ctx.rotate((-angle.value * Math.PI) / 180);
        ctx.lineWidth = 3;
        ctx.strokeStyle = pal.ink;
        ctx.fillStyle = pal.screen;
        rr(ctx, -16, -12, BARREL_LENGTH + 18, 24, 11);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = pal.frame;
        rr(ctx, BARREL_LENGTH - 4, -14, 9, 28, 4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = pal.ink;
        ctx.fillStyle = pal.frame;
        rr(ctx, PIVOT.x - 20, sy(PIVOT.y) + 2, 40, 18, 8);
        ctx.fill();
        ctx.stroke();

        if (ball) {
            ctx.beginPath();
            ctx.fillStyle = pal.blush;
            ctx.lineWidth = 2;
            ctx.arc(ball.x, sy(ball.y), BALL_RADIUS + 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    function frame(now) {
        if (!canvas.isConnected) return;
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        if (!done) {
            basket = oscillate(basket.value, basket.dir, BASKET.speed, BASKET.minX, BASKET.maxX, dt);
            if (!ball) {
                angle = oscillate(angle.value, angle.dir, ANGLE_RANGE.speed, ANGLE_RANGE.min, ANGLE_RANGE.max, dt);
            } else {
                const next = stepBall(ball, gravity, dt);
                if (crossesBasketTop(ball, next, basket.value)) resolveShot(true);
                else if (isOut(next)) resolveShot(false);
                else ball = next;
            }
        }
        draw();
        requestAnimationFrame(frame);
    }

    canvas.addEventListener("pointerdown", fire);
    canvas.addEventListener("keydown", (e) => {
        if (e.code === "Space" || e.code === "Enter") {
            e.preventDefault();
            fire();
        }
    });

    root.replaceChildren(
        el("p", { class: "challenge-help", text: `The cannon swings on its own. Click (or press Space) to fire. Land ${needed} in a row in the moving basket.` }),
        progress,
        canvas,
        status
    );
    render();
    canvas.focus();
    requestAnimationFrame(frame);
}
