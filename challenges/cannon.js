// Cannon into basket: aim with the mouse (or arrow keys), land N shots in a row in a moving basket.
// A dotted guide shows the first part of the arc and fades out, so the landing is still a judgment call.
// A miss resets the streak.
// World coordinates are y-up with the ground at y = 0, units in px and seconds.
import { el } from "./ui.js";

export const STREAK = { full: 4, mini: 2 };
export const WORLD = { width: 480, height: 260 };
export const MUZZLE_SPEED = 600;
export const PIVOT = { x: 44, y: 24 };
export const BARREL_LENGTH = 34;
export const ANGLE_RANGE = { min: 20, max: 80 }; // degrees
export const GUIDE_FRACTION = 0.55; // share of the predicted flight the guide shows before fading out
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

export function clampAngle(deg) {
    return Math.min(ANGLE_RANGE.max, Math.max(ANGLE_RANGE.min, deg));
}

// Angle (degrees) from the cannon pivot to a point in world coordinates (y-up).
export function aimAngle(x, y) {
    return clampAngle((Math.atan2(y - PIVOT.y, Math.max(1, x - PIVOT.x)) * 180) / Math.PI);
}

// Points along the flight for a given angle, until the ball leaves the field.
export function predictPath(angleDeg, gravity, dt = 1 / 60, maxSteps = 240) {
    const points = [];
    let ball = launch(angleDeg);
    for (let i = 0; i < maxSteps; i++) {
        points.push({ x: ball.x, y: ball.y });
        ball = stepBall(ball, gravity, dt);
        if (isOut(ball)) break;
    }
    return points;
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
    const pal = { ink, screen: C("--m-screen", "#3a3743"), frame: C("--m-frame", "#c9c3d6"), cream: C("--m-cream", "#f2e8ca"), blush: C("--m-blush", "#ee93ab"), slate: C("--m-slate", "#5c6688"), ground: C("--surface", "#474452"), guide: C("--text", "#f2e8ca") };

    let angle = 45;
    let basket = { value: BASKET.minX + rng() * (BASKET.maxX - BASKET.minX), dir: rng() < 0.5 ? -1 : 1 };
    let ball = null;
    let streak = 0;
    let best = 0;
    let shots = 0;
    let done = false;
    let last = performance.now();

    const canvas = el("canvas", {
        class: "cannon-canvas",
        width: String(WORLD.width),
        height: String(WORLD.height),
        tabindex: "0",
        role: "img",
        "aria-label": "Cannon game. Arrow keys aim, Space fires."
    });
    // Spoken state for keyboard and screen-reader players: aim angle and where the basket is.
    const aimText = el("div", { class: "sr-only", "aria-live": "polite" });
    const announceAim = () => {
        const where = basket.value < BASKET.minX + (BASKET.maxX - BASKET.minX) / 3 ? "near" : basket.value > BASKET.maxX - (BASKET.maxX - BASKET.minX) / 3 ? "far" : "middle";
        aimText.textContent = `Aim ${Math.round(angle)} degrees. Basket is ${where}.`;
    };
    const ctx = canvas.getContext("2d");
    const progress = el("div", { class: "challenge-progress" });
    const status = el("div", { class: "challenge-status", role: "status", "aria-live": "polite" });

    function render() {
        progress.textContent = `Streak ${streak} / ${needed} · best ${best} · shots ${shots}`;
    }

    function fire() {
        if (ball || done) return;
        shots += 1;
        ball = launch(angle);
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

        // aim guide: dots along the predicted arc, fading out partway
        if (!ball && !done) {
            const path = predictPath(angle, gravity);
            const shown = Math.max(2, Math.floor(path.length * GUIDE_FRACTION));
            ctx.fillStyle = pal.guide;
            for (let i = 4; i < shown; i += 4) {
                ctx.globalAlpha = 0.9 * (1 - i / shown);
                ctx.beginPath();
                ctx.arc(path[i].x, sy(path[i].y), 3.6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // cannon: charcoal barrel with a frame-colored muzzle ring, sitting on a base
        ctx.save();
        ctx.translate(PIVOT.x, sy(PIVOT.y));
        ctx.rotate((-angle * Math.PI) / 180);
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
            if (ball) {
                const next = stepBall(ball, gravity, dt);
                if (crossesBasketTop(ball, next, basket.value)) resolveShot(true);
                else if (isOut(next)) resolveShot(false);
                else ball = next;
            }
        }
        draw();
        requestAnimationFrame(frame);
    }

    function aimAt(e) {
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * WORLD.width;
        const y = WORLD.height - ((e.clientY - rect.top) / rect.height) * WORLD.height;
        if (!ball) angle = aimAngle(x, y);
    }

    canvas.addEventListener("pointermove", aimAt);
    canvas.addEventListener("pointerdown", (e) => {
        aimAt(e);
        fire();
    });
    canvas.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 5 : 1.5;
        if (e.code === "Space" || e.code === "Enter") {
            e.preventDefault();
            fire();
        } else if (e.code === "ArrowUp" || e.code === "ArrowLeft") {
            e.preventDefault();
            if (!ball) angle = clampAngle(angle + step);
            announceAim();
        } else if (e.code === "ArrowDown" || e.code === "ArrowRight") {
            e.preventDefault();
            if (!ball) angle = clampAngle(angle - step);
            announceAim();
        }
    });

    root.replaceChildren(
        el("p", { class: "challenge-help", text: `Aim with your mouse (or the arrow keys), then click or press Space to fire. The guide fades out, so lead the moving basket. Land ${needed} in a row.` }),
        progress,
        canvas,
        status,
        aimText
    );
    render();
    canvas.focus();
    requestAnimationFrame(frame);
}
