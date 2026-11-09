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

function loadImage(name) {
    const img = new Image();
    img.src = new URL(`../${name}`, import.meta.url).href;
    return img;
}

export function mount(root, { mini, onComplete, rng = Math.random }) {
    const needed = mini ? STREAK.mini : STREAK.full;
    const gravity = 760 + rng() * 140;
    const cannonImg = loadImage("cannon.png");
    const basketImg = loadImage("basket.png");

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
            if (streak >= needed) {
                done = true;
                render();
                onComplete();
                return;
            }
        } else {
            if (streak > 0) status.textContent = "Miss. Streak reset.";
            else status.textContent = "Miss.";
            streak = 0;
        }
        render();
    }

    const sy = (y) => WORLD.height - y;

    function draw() {
        ctx.clearRect(0, 0, WORLD.width, WORLD.height);
        ctx.fillStyle = "#555";
        ctx.fillRect(0, WORLD.height - 4, WORLD.width, 4);

        // basket
        const bw = BASKET.width + 8;
        const bh = BASKET.height + 4;
        if (basketImg.complete && basketImg.naturalWidth) {
            ctx.drawImage(basketImg, basket.value - bw / 2, sy(bh), bw, bh);
        } else {
            ctx.fillStyle = "#c9b99a";
            ctx.fillRect(basket.value - BASKET.width / 2, sy(BASKET.height), BASKET.width, BASKET.height);
        }

        // cannon
        ctx.save();
        ctx.translate(PIVOT.x, sy(PIVOT.y));
        ctx.rotate((-angle.value * Math.PI) / 180);
        if (cannonImg.complete && cannonImg.naturalWidth) {
            ctx.drawImage(cannonImg, -24, -20, 72, 40);
        } else {
            ctx.fillStyle = "#333";
            ctx.fillRect(-10, -10, BARREL_LENGTH + 10, 20);
        }
        ctx.restore();

        if (ball) {
            ctx.beginPath();
            ctx.fillStyle = "#ff79c6";
            ctx.arc(ball.x, sy(ball.y), BALL_RADIUS, 0, Math.PI * 2);
            ctx.fill();
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
