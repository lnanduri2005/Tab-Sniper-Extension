// The roaming mascot for full-tab pages: hops between perches, carries its own speech bubble,
// can be dragged (snaps to the nearest perch) or thrown (flies off, comes back at the farthest
// perch, offended), and wanders when idle unless told to hold still.
//
//   const roamer = createRoamer({ mood: "mischievous", onTap });
//   roamer.setPerches([{ id: "tabs", target: ".tabs", mode: "sit", align: 0.9 }, ...], "tabs");
//   roamer.goTo("stats", { mood: "smug", say: "Down 40%. Suspicious." });
import { createMascot } from "./mascot.js";
import { perchPosition, hopPath, nearestIndex, farthestIndex, releaseVelocity, bubbleSide, THROW_SPEED } from "./roam-math.js";
import { say as line } from "./voice.js";

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ASPECT = 100 / 120; // mascot drawing is 120x100

export function createRoamer({ mood = "idle", size = 96, label = "Tab Sniper mascot. Tap for a status report.", onTap = null, still = false, play = () => {} } = {}) {
    const box = { w: size, h: size * ASPECT };
    const mascot = createMascot({ mood, label, onTap: () => onTap?.(), idle: { boredMs: 45000, sleepMs: 150000 } });
    const el = document.createElement("div");
    el.className = "roamer";
    el.style.width = `${box.w}px`;
    el.append(mascot.el);

    const bubble = document.createElement("p");
    bubble.className = "bubble roam-bubble";
    bubble.setAttribute("aria-live", "polite");
    document.body.append(el, bubble);

    let perches = [];
    let currentId = null;
    let pos = { x: -9999, y: -9999, rot: 0 };
    let anim = null;
    let bubbleTimer = null;
    let wanderTimer = null;
    let holdStill = still;
    let busy = false;

    // ---------- placement ----------

    function resolve(perch) {
        const t = typeof perch.target === "function" ? perch.target() : typeof perch.target === "string" ? document.querySelector(perch.target) : perch.target;
        if (!t || !t.isConnected) return null;
        const r = t.getBoundingClientRect();
        if (!r.width && !r.height) return null;
        return { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height };
    }

    function onScreen(p) {
        const pageW = document.documentElement.scrollWidth;
        return p.x > -box.w * 0.6 && p.x + box.w * 0.4 < pageW && p.y > -box.h * 0.4;
    }

    function positionFor(perch) {
        const rect = resolve(perch);
        if (!rect) return null;
        const p = { ...perchPosition(rect, perch, box), id: perch.id };
        return onScreen(p) ? p : null;
    }

    function available() {
        return perches.map((p) => ({ perch: p, at: positionFor(p) })).filter((x) => x.at);
    }

    function setLayer(layer) {
        el.classList.toggle("back", layer === "back");
    }

    function place(p) {
        pos = { x: p.x, y: p.y, rot: p.rot || 0 };
        el.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rot}deg)`;
    }

    // ---------- bubble ----------

    function placeBubble() {
        if (bubble.hidden) return;
        const viewport = { left: scrollX, top: scrollY, width: innerWidth, height: innerHeight };
        const b = { w: bubble.offsetWidth, h: bubble.offsetHeight };
        const prefer = perches.find((p) => p.id === currentId)?.bubble || null;
        const side = bubbleSide({ ...pos, w: box.w, h: box.h }, viewport, b, prefer);
        bubble.dataset.side = side;
        let x, y;
        if (side === "left") { x = pos.x - b.w - 14; y = pos.y + box.h * 0.45 - b.h / 2; }
        else if (side === "right") { x = pos.x + box.w + 14; y = pos.y + box.h * 0.45 - b.h / 2; }
        else { x = pos.x + box.w / 2 - b.w / 2; y = pos.y - b.h - 14; }
        x = Math.max(scrollX + 8, Math.min(x, scrollX + innerWidth - b.w - 8));
        y = Math.max(scrollY + 8, y);
        bubble.style.transform = `translate(${x}px, ${y}px)`;
    }

    function say(text, ms = 5000) {
        if (!text) return;
        clearTimeout(bubbleTimer);
        bubble.textContent = text;
        bubble.hidden = false;
        bubble.classList.remove("show");
        placeBubble();
        requestAnimationFrame(() => bubble.classList.add("show"));
        bubbleTimer = setTimeout(hideBubble, ms);
    }

    function hideBubble() {
        bubble.classList.remove("show");
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => (bubble.hidden = true), 250);
    }
    bubble.hidden = true;

    // ---------- motion ----------

    function hopTo(target, { onLand } = {}) {
        anim?.cancel();
        const from = { ...pos };
        if (reduceMotion() || from.x < -5000) {
            el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: from.x < -5000 ? 0 : 140 }).finished.then(() => {
                place(target);
                setLayer(target.layer);
                el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
                placeBubble();
                onLand?.();
            });
            return;
        }
        const { points, duration } = hopPath(from, target);
        setLayer("front");
        const frames = points.map((p, i) => {
            const t = i / (points.length - 1);
            const rot = from.rot + (target.rot - from.rot) * t;
            return { transform: `translate(${p.x}px, ${p.y}px) rotate(${rot}deg)` };
        });
        busy = true;
        hideBubbleDuringHop();
        mascot.el.animate(
            [
                { transform: "scale(1, 1)" },
                { transform: "scale(1.12, 0.84)", offset: 0.12 },
                { transform: "scale(0.9, 1.12)", offset: 0.4 },
                { transform: "scale(1.14, 0.86)", offset: 0.92 },
                { transform: "scale(1, 1)" }
            ],
            { duration, easing: "ease-out" }
        );
        anim = el.animate(frames, { duration, easing: "linear" });
        anim.onfinish = () => {
            place(target);
            setLayer(target.layer);
            busy = false;
            placeBubble();
            showBubbleAfterHop();
            onLand?.();
        };
        play("tick");
    }

    let bubbleWasOpen = false;
    function hideBubbleDuringHop() {
        bubbleWasOpen = !bubble.hidden;
        bubble.classList.remove("show");
    }
    function showBubbleAfterHop() {
        if (bubbleWasOpen && !bubble.hidden) bubble.classList.add("show");
    }

    function goTo(id, { mood: m, say: text, instant = false } = {}) {
        let perch = perches.find((p) => p.id === id);
        let target = perch && positionFor(perch);
        if (!target) {
            // requested perch is hidden or off-screen: use the first one that works
            const fallback = available()[0];
            if (!fallback) return;
            perch = fallback.perch;
            target = fallback.at;
        }
        currentId = perch.id;
        const land = () => {
            if (m) mascot.express(m, 2400);
            if (text) say(text);
        };
        if (instant) {
            place(target);
            setLayer(target.layer);
            land();
        } else {
            hopTo(target, { onLand: land });
        }
        scheduleWander();
    }

    function setPerches(list, startId) {
        perches = list;
        if (startId) goTo(startId, { instant: pos.x < -5000 });
    }

    // ---------- drag & throw ----------

    let drag = null;

    el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        drag = { startX: e.clientX, startY: e.clientY, offX: e.pageX - pos.x, offY: e.pageY - pos.y, samples: [], moved: false };
        el.setPointerCapture(e.pointerId);
    });

    el.addEventListener("pointermove", (e) => {
        if (!drag) return;
        drag.samples.push({ x: e.pageX, y: e.pageY, t: e.timeStamp });
        if (drag.samples.length > 12) drag.samples.shift();
        if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
            drag.moved = true;
            anim?.cancel();
            el.classList.add("dragging");
            setLayer("front");
            mascot.express("surprised", 60000);
            say(line("roam.lifted"), 2000);
        }
        if (drag.moved) {
            place({ x: e.pageX - drag.offX, y: e.pageY - drag.offY, rot: Math.max(-20, Math.min(20, (e.movementX || 0) * 2)) });
            placeBubble();
        }
    });

    function endDrag(e) {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (!d.moved) return; // plain tap: the mascot's click handler takes it
        mascot.el.dataset.dragged = "1";
        setTimeout(() => delete mascot.el.dataset.dragged, 0);
        el.classList.remove("dragging");
        const release = { x: e.pageX, y: e.pageY };
        const v = releaseVelocity(d.samples);
        const list = available();
        if (!list.length) return;
        if (v.speed > THROW_SPEED) throwAway(v, release, list);
        else dropNear(release, list);
    }
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);

    function dropNear(point, list) {
        const i = nearestIndex(list.map((x) => x.at), point, box);
        currentId = list[i].perch.id;
        hopTo(list[i].at, {
            onLand: () => {
                mascot.express("grudging", 2200);
                say(line("roam.dropped"), 2500);
            }
        });
        scheduleWander();
    }

    function throwAway(v, point, list) {
        const i = farthestIndex(list.map((x) => x.at), point, box);
        const target = list[i].at;
        currentId = list[i].perch.id;
        hideBubble();
        play("oops");
        const k = 0.45;
        const flyTo = { x: pos.x + v.vx * k, y: pos.y + v.vy * k };
        const spin = (v.vx >= 0 ? 1 : -1) * 540;
        const finish = () => {
            place(target);
            setLayer(target.layer);
            el.animate(
                [{ transform: `translate(${target.x}px, ${target.y + 40}px) rotate(${target.rot}deg) scale(0.6)`, opacity: 0 }, { transform: `translate(${target.x}px, ${target.y}px) rotate(${target.rot}deg) scale(1)`, opacity: 1 }],
                { duration: reduceMotion() ? 0 : 380, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
            );
            mascot.express("angry", 3200);
            say(line("roam.thrown"), 3000);
        };
        if (reduceMotion()) return finish();
        anim = el.animate(
            [{ transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rot}deg)`, opacity: 1 }, { transform: `translate(${flyTo.x}px, ${flyTo.y}px) rotate(${pos.rot + spin}deg)`, opacity: 0 }],
            { duration: 450, easing: "cubic-bezier(0.2, 0.6, 0.4, 1)" }
        );
        anim.onfinish = () => setTimeout(finish, 650);
        scheduleWander();
    }

    // ---------- idle wander ----------

    function scheduleWander() {
        clearTimeout(wanderTimer);
        if (holdStill) return;
        wanderTimer = setTimeout(wander, 30000 + Math.random() * 30000);
    }

    function wander() {
        if (busy || drag || document.hidden) return scheduleWander();
        const list = available().filter((x) => x.perch.id !== currentId && !x.perch.noWander);
        if (!list.length) return scheduleWander();
        const peeks = list.filter((x) => x.perch.mode === "peek");
        const pool = peeks.length && Math.random() < 0.6 ? peeks : list;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        goTo(pick.perch.id, Math.random() < 0.3 ? { say: line("roam.idle") } : {});
    }

    const onInput = () => scheduleWander();
    document.addEventListener("pointerdown", onInput, true);
    document.addEventListener("keydown", onInput, true);

    // ---------- keep in place on layout changes ----------

    let raf = 0;
    const relayout = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            if (busy || drag || !currentId) return;
            const perch = perches.find((p) => p.id === currentId);
            const target = perch && positionFor(perch);
            if (target) { place(target); setLayer(target.layer); }
            placeBubble();
        });
    };
    addEventListener("resize", relayout);
    const ro = new ResizeObserver(relayout);
    ro.observe(document.body);

    return {
        mascot,
        el,
        say,
        goTo,
        setPerches,
        relayout,
        get perchId() { return currentId; },
        hide() {
            hideBubble();
            el.hidden = true;
        },
        show() {
            el.hidden = false;
            relayout();
        },
        setStill(v) {
            holdStill = !!v;
            scheduleWander();
        },
        destroy() {
            clearTimeout(wanderTimer);
            clearTimeout(bubbleTimer);
            ro.disconnect();
            removeEventListener("resize", relayout);
            document.removeEventListener("pointerdown", onInput, true);
            document.removeEventListener("keydown", onInput, true);
            mascot.destroy();
            el.remove();
            bubble.remove();
        }
    };
}
