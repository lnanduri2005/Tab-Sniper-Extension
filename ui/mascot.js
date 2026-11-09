// The Tab Sniper mascot: a browser window with a face. Pure SVG, no limbs.
// Expression = eyes + brows + mouth + extras, plus body motion (squash, bounce, tilt)
// and its title-bar dots.
//
//   const m = createMascot({ mood: "mischievous" });
//   parent.append(m.el);
//   m.express("smug", 2000);   // temporary mood
//   m.react("bounce");         // one-shot body motion

const NS = "http://www.w3.org/2000/svg";

// Eye centers and face anchors in the 120x100 drawing.
const EYE_L = [44, 60];
const EYE_R = [76, 60];
const MOUTH = [60, 70];

const EYES = {
    round: (cx, cy) => `
        <g class="eye-shape" transform="translate(${cx} ${cy})">
            <ellipse rx="8.4" ry="9.4" class="ink"/>
            <circle cx="-2.9" cy="-3.5" r="3" class="shine"/>
            <circle cx="2.9" cy="3.1" r="1.3" class="shine"/>
        </g>`,
    wide: (cx, cy) => `
        <g class="eye-shape" transform="translate(${cx} ${cy})">
            <ellipse rx="9.2" ry="10" class="ink"/>
            <circle cx="-3" cy="-3.6" r="3.3" class="shine"/>
            <circle cx="3.2" cy="3.4" r="1.5" class="shine"/>
        </g>`,
    half: (cx, cy) => `
        <g class="eye-shape" transform="translate(${cx} ${cy})">
            <ellipse rx="8.4" ry="9.4" class="ink"/>
            <circle cx="-2.8" cy="2" r="2.4" class="shine"/>
            <rect x="-11" y="-12" width="22" height="11.4" class="lid"/>
            <path d="M -9.4 -0.6 L 9.4 -0.6" class="stroke"/>
        </g>`,
    closed: (cx, cy) => `<path transform="translate(${cx} ${cy})" d="M -7.5 -1 Q 0 6.5 7.5 -1" class="stroke thick"/>`,
    happy: (cx, cy) => `<path transform="translate(${cx} ${cy})" d="M -7.5 3 Q 0 -6.5 7.5 3" class="stroke thick"/>`,
    dizzy: (cx, cy) => `<path transform="translate(${cx} ${cy})" d="M -5 -5 L 5 5 M 5 -5 L -5 5" class="stroke thick"/>`
};

const MOUTHS = {
    w: "M -6.5 -1.5 Q -3.2 3.2 0 0 Q 3.2 3.2 6.5 -1.5",
    smirkW: "M -6.5 0 Q -3.2 3.4 0 0.4 Q 3.6 2.6 7.5 -3.4",
    smirk: "M -6.5 1.6 Q 1.5 4.6 7.5 -2.4",
    flat: "M -5 1 L 5 1",
    frown: "M -6 3.2 Q 0 -2.4 6 3.2",
    wavy: "M -7.5 1 Q -5.6 -1.4 -3.7 1 Q -1.8 3.4 0 1 Q 1.8 -1.4 3.7 1 Q 5.6 3.4 7.5 1",
    open: "M -7 -1.5 Q 0 10 7 -1.5 Z",
    o: "M 0 -3.6 A 3.2 3.8 0 1 1 -0.01 -3.6 Z",
    tiny: "M -3 0 Q 0 2 3 0"
};

const BROWS = {
    scheme: ["M 35 46 L 49 50", "M 85 46 L 71 50"],
    stern: ["M 35 44 L 50 51", "M 85 44 L 70 51"],
    worried: ["M 36 50 L 49 45", "M 84 50 L 71 45"],
    raised: ["M 37 45 Q 44 41 51 45", "M 69 45 Q 76 41 83 45"]
};

// mood -> face recipe
export const MOODS = {
    idle: { eyes: "round", mouth: "w", track: true },
    mischievous: { eyes: "round", brows: "scheme", mouth: "smirkW", track: true },
    sleep: { eyes: "closed", mouth: "tiny", zzz: true },
    smug: { eyes: "half", mouth: "smirk", track: true },
    stern: { eyes: "round", brows: "stern", mouth: "flat", track: true },
    angry: { eyes: "round", brows: "stern", mouth: "frown", extra: "anger", track: true },
    nervous: { eyes: "round", brows: "worried", mouth: "wavy", extra: "sweat", track: true },
    happy: { eyes: "happy", mouth: "open", blush: "big" },
    proud: { eyes: "happy", mouth: "w", blush: "big", extra: "sparkle" },
    surprised: { eyes: "wide", brows: "raised", mouth: "o", track: true },
    bored: { eyes: "half", mouth: "flat", track: false, look: [3, 1] },
    grudging: { eyes: "half", brows: "worried", mouth: "flat", track: true },
    dizzy: { eyes: "dizzy", mouth: "wavy" }
};

const EXTRAS = {
    sweat: `<path d="M 97 44 q 4 7 0 9 q -4 -2 0 -9 z" class="sweat"/>`,
    anger: `<path d="M 92 42 l 4 4 m 0 -4 l -4 4 M 98 40 l 3 3 m 0 -3 l -3 3" class="anger"/>`,
    sparkle: `<path d="M 99 42 l 1.6 4 l 4 1.6 l -4 1.6 l -1.6 4 l -1.6 -4 l -4 -1.6 l 4 -1.6 z" class="sparkle"/>`
};

function drawFace(mood) {
    const r = MOODS[mood] || MOODS.idle;
    const eye = EYES[r.eyes];
    const brows = r.brows ? BROWS[r.brows].map((d) => `<path d="${d}" class="stroke thick"/>`).join("") : "";
    const blushR = r.blush === "big" ? [7.5, 4.2] : [6, 3.4];
    return `
        <g class="blush">
            <ellipse cx="31" cy="71" rx="${blushR[0]}" ry="${blushR[1]}"/>
            <ellipse cx="89" cy="71" rx="${blushR[0]}" ry="${blushR[1]}"/>
        </g>
        <g class="eyes">
            <g class="eye"><g class="blinker">${eye(...EYE_L)}</g></g>
            <g class="eye"><g class="blinker">${eye(...EYE_R)}</g></g>
        </g>
        ${brows}
        <path class="mouth ${r.mouth === "open" || r.mouth === "o" ? "filled" : "stroke"}" transform="translate(${MOUTH[0]} ${MOUTH[1]})" d="${MOUTHS[r.mouth]}"/>
        ${r.extra ? EXTRAS[r.extra] : ""}`;
}

function svgMarkup(variant) {
    const viewBox = variant === "face" ? "14 36 92 50" : "0 0 120 100";
    return `
<svg xmlns="${NS}" viewBox="${viewBox}" class="mascot-svg" aria-hidden="true">
  <g class="body">
    <g class="frame-parts">
      <rect x="4" y="4" width="112" height="92" rx="18" class="frame"/>
      <path d="M 4 30 L 4 22 Q 4 4 22 4 L 98 4 Q 116 4 116 22 L 116 30 Z" class="titlebar"/>
      <path d="M 4 30 L 116 30" class="stroke"/>
      <rect x="4" y="4" width="112" height="92" rx="18" class="outline"/>
      <circle cx="20" cy="17" r="5.2" class="dot dot-a"/>
      <circle cx="35" cy="17" r="5.2" class="dot dot-b"/>
      <g class="zzz"><text x="80" y="23">z</text><text x="88" y="21">Z</text><text x="98" y="19">z</text></g>
    </g>
    <rect x="14" y="36" width="92" height="50" rx="11" class="screen"/>
    <g class="face"></g>
  </g>
</svg>`;
}

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createMascot({ mood = "idle", variant = "full", label = "Tab Sniper mascot", interactive = true, idle = null, onTap = null } = {}) {
    const el = document.createElement("div");
    el.className = `mascot mascot-${variant}`;
    el.setAttribute("role", interactive ? "button" : "img");
    el.setAttribute("aria-label", label);
    el.innerHTML = svgMarkup(variant);
    const svg = el.querySelector("svg");
    const face = el.querySelector(".face");

    let baseMood = mood;
    let current = null;
    let tempTimer = null;
    let blinkTimer = null;
    let idleTimers = [];
    let pokes = [];
    const listeners = new Set();

    function render(m) {
        if (current === m) return;
        current = m;
        face.innerHTML = drawFace(m);
        el.dataset.mood = m;
        if (!MOODS[m]?.look) setEyeOffset(...(MOODS[m]?.track ? eyeOffset : [0, 0]));
        svg.classList.toggle("sleeping", !!MOODS[m]?.zzz);
        const look = MOODS[m]?.look;
        if (look) setEyeOffset(look[0], look[1]);
    }

    // Tracking lives on .eye (CSS translate); blinking lives on the inner .blinker (CSS scaleY).
    // Keeping them on separate elements stops one transform from overwriting the other.
    let eyeOffset = [0, 0];
    function setEyeOffset(dx, dy) {
        eyeOffset = [dx, dy];
        face.querySelectorAll(".eye").forEach((g) => {
            g.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
        });
    }

    function setMood(m) {
        baseMood = m;
        if (!tempTimer) render(m);
    }

    function express(m, ms = 1800) {
        clearTimeout(tempTimer);
        render(m);
        tempTimer = setTimeout(() => {
            tempTimer = null;
            render(baseMood);
        }, ms);
    }

    function react(name) {
        if (reduceMotion()) return;
        svg.classList.remove(`r-${name}`);
        void svg.getBoundingClientRect();
        svg.classList.add(`r-${name}`);
        svg.addEventListener("animationend", () => svg.classList.remove(`r-${name}`), { once: true });
    }

    function scheduleBlink() {
        blinkTimer = setTimeout(() => {
            const eyes = face.querySelector(".eyes");
            if (eyes && ["round", "wide", "half"].includes(MOODS[current]?.eyes)) {
                eyes.classList.add("blink");
                setTimeout(() => eyes.classList.remove("blink"), 110);
            }
            scheduleBlink();
        }, 2600 + Math.random() * 3600);
    }

    function onPointerMove(e) {
        if (!MOODS[current]?.track) return;
        const rect = svg.getBoundingClientRect();
        if (!rect.width) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height * 0.6;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, dist / 260);
        setEyeOffset((dx / dist) * 2.8 * reach, (dy / dist) * 2.2 * reach);
        resetIdle();
    }

    function resetIdle() {
        if (!idle) return;
        idleTimers.forEach(clearTimeout);
        if (current === "bored" || (current === "sleep" && baseMood !== "sleep")) render(baseMood);
        idleTimers = [
            setTimeout(() => { if (!tempTimer && baseMood !== "sleep") render("bored"); }, idle.boredMs),
            setTimeout(() => { if (!tempTimer) render("sleep"); }, idle.sleepMs)
        ];
    }

    function poke() {
        const now = Date.now();
        pokes = pokes.filter((t) => now - t < 2500).concat(now);
        if (pokes.length >= 4) {
            express("angry", 2200);
            react("shake");
        } else if (current === "sleep") {
            express("surprised", 1200);
            react("hop");
        } else {
            express(pokes.length >= 2 ? "dizzy" : "surprised", 1000);
            react("squash");
        }
        listeners.forEach((fn) => fn("poke", pokes.length));
        resetIdle();
    }

    if (interactive) {
        el.classList.add("pokeable");
        el.tabIndex = 0;
        const tap = () => (onTap ? onTap() : poke());
        el.addEventListener("click", (e) => {
            if (el.dataset.dragged) return; // a drag or throw just ended; not a tap
            tap(e);
        });
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                tap();
            }
        });
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("keydown", resetIdle);
    }

    render(mood);
    scheduleBlink();
    resetIdle();

    return {
        el,
        setMood,
        poke,
        get baseMood() { return baseMood; },
        express,
        react,
        get mood() { return current; },
        on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        destroy() {
            clearTimeout(tempTimer);
            clearTimeout(blinkTimer);
            idleTimers.forEach(clearTimeout);
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("keydown", resetIdle);
            el.remove();
        }
    };
}
