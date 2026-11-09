// Injected into Watched sites with chrome.scripting.executeScript({ func: siteMascot, args }).
// Must stay self-contained: no imports, no outer variables. Draws in a closed shadow root with
// the mascot's own fixed palette (the host page's CSS can't reach it). Reads nothing from the page.
//
// mode "peek":   rises from the bottom-right edge, says `text`, ducks away after ~8s.
//                Tap = status fact (asks the extension), throw = dismiss, drop = slides back.
// mode "cutoff": hops to the middle of the page, says `text`, then the screen fills with the
//                mascot's charcoal so the redirect to the block page reads as one motion.
export function siteMascot(mode, text, fontUrl) {
    const HOST_ID = "tab-sniper-mascot-host";
    document.getElementById(HOST_ID)?.remove();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (fontUrl && !document.fonts.check('800 14px "TS Mascot Rounded"')) {
        try {
            const face = new FontFace("TS Mascot Rounded", `url(${fontUrl})`, { weight: "800" });
            face.load().then((f) => document.fonts.add(f)).catch(() => {});
        } catch {
            /* fall back to system rounded */
        }
    }

    const FACES = {
        smug: '<g fill="#141218"><ellipse cx="44" cy="60" rx="8.4" ry="9.4"/><ellipse cx="76" cy="60" rx="8.4" ry="9.4"/></g><g fill="#3a3743"><rect x="33" y="48" width="22" height="11.4"/><rect x="65" y="48" width="22" height="11.4"/></g><g fill="#fdfcff"><circle cx="41.2" cy="62" r="2.4"/><circle cx="73.2" cy="62" r="2.4"/></g><path d="M34.6 59.4H53.4M66.6 59.4H85.4" stroke="#141218" stroke-width="2.6" stroke-linecap="round"/><path d="M53.5 71.6Q61.5 74.6 67.5 67.6" fill="none" stroke="#141218" stroke-width="2.6" stroke-linecap="round"/>',
        stern: '<g fill="#141218"><ellipse cx="44" cy="60" rx="8.4" ry="9.4"/><ellipse cx="76" cy="60" rx="8.4" ry="9.4"/></g><g fill="#fdfcff"><circle cx="41.1" cy="56.5" r="3"/><circle cx="73.1" cy="56.5" r="3"/></g><path d="M35 44L50 51M85 44L70 51" stroke="#141218" stroke-width="3.2" stroke-linecap="round"/><path d="M55 71H65" stroke="#141218" stroke-width="2.6" stroke-linecap="round"/>',
        surprised: '<g fill="#141218"><ellipse cx="44" cy="60" rx="9.2" ry="10"/><ellipse cx="76" cy="60" rx="9.2" ry="10"/></g><g fill="#fdfcff"><circle cx="41" cy="56.4" r="3.3"/><circle cx="73" cy="56.4" r="3.3"/></g><ellipse cx="60" cy="71" rx="3.2" ry="3.8" fill="#141218"/>',
        angry: '<g fill="#141218"><ellipse cx="44" cy="60" rx="8.4" ry="9.4"/><ellipse cx="76" cy="60" rx="8.4" ry="9.4"/></g><g fill="#fdfcff"><circle cx="41.1" cy="56.5" r="3"/><circle cx="73.1" cy="56.5" r="3"/></g><path d="M35 44L50 51M85 44L70 51" stroke="#141218" stroke-width="3.2" stroke-linecap="round"/><path d="M54 73.2Q60 67.6 66 73.2" fill="none" stroke="#141218" stroke-width="2.6" stroke-linecap="round"/><path d="M92 42l4 4m0-4l-4 4M98 40l3 3m0-3l-3 3" stroke="#ee93ab" stroke-width="2.6" stroke-linecap="round"/>',
        happy: '<path d="M36.5 63Q44 53.5 51.5 63M68.5 63Q76 53.5 83.5 63" fill="none" stroke="#141218" stroke-width="3.2" stroke-linecap="round"/><path d="M53 68.5Q60 80 67 68.5Z" fill="#141218" stroke="#141218" stroke-width="1.5" stroke-linejoin="round"/>'
    };
    const body = (face) => `
        <rect x="4" y="4" width="112" height="92" rx="18" fill="#c9c3d6"/>
        <path d="M4 30V22Q4 4 22 4H98Q116 4 116 22V30Z" fill="#f2e8ca"/>
        <path d="M4 30H116" stroke="#221f29" stroke-width="3"/>
        <rect x="4" y="4" width="112" height="92" rx="18" fill="none" stroke="#221f29" stroke-width="4"/>
        <circle cx="20" cy="17" r="5.2" fill="#ee93ab" stroke="#221f29" stroke-width="2.6"/>
        <circle cx="35" cy="17" r="5.2" fill="#5c6688" stroke="#221f29" stroke-width="2.6"/>
        <rect x="14" y="36" width="92" height="50" rx="11" fill="#3a3743" stroke="#221f29" stroke-width="3.2"/>
        <ellipse cx="31" cy="71" rx="6" ry="3.4" fill="#ee93ab"/><ellipse cx="89" cy="71" rx="6" ry="3.4" fill="#ee93ab"/>
        <g class="face">${FACES[face]}</g>`;

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all: initial; position: fixed; z-index: 2147483647; inset: 0; pointer-events: none;";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
        * { box-sizing: border-box; }
        .mascot { position: absolute; width: 124px; cursor: grab; pointer-events: auto; touch-action: none; user-select: none; filter: drop-shadow(0 5px 0 rgba(34,31,41,0.35)); }
        .mascot svg { display: block; width: 100%; height: auto; }
        .mascot.dragging { cursor: grabbing; }
        .bubble {
            position: absolute;
            max-width: 260px;
            padding: 10px 14px;
            background: #fdfcff;
            color: #221f29;
            border: 2.5px solid #221f29;
            border-radius: 18px;
            font: 800 14px/1.35 "TS Mascot Rounded", "M PLUS Rounded 1c", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease-out;
        }
        .bubble.show { opacity: 1; }
        .bubble::after {
            content: ""; position: absolute; width: 14px; height: 14px; background: #fdfcff;
            border-right: 2.5px solid #221f29; border-bottom: 2.5px solid #221f29; border-bottom-right-radius: 3px;
        }
        .bubble.tail-right::after { right: -9px; top: 50%; transform: translateY(-50%) rotate(-45deg); }
        .bubble.tail-down::after { left: 50%; bottom: -9px; transform: translateX(-50%) rotate(45deg); }
        .shade { position: absolute; inset: 0; background: #3a3743; opacity: 0; transition: opacity 0.5s ease-in; }
    `;
    const mascotEl = document.createElement("div");
    mascotEl.className = "mascot";
    mascotEl.setAttribute("role", "img");
    mascotEl.setAttribute("aria-label", "Tab Sniper mascot");
    const svg = (face) => `<svg viewBox="0 0 120 100" aria-hidden="true">${body(face)}</svg>`;
    const setFace = (face) => (mascotEl.innerHTML = svg(face));
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.setAttribute("role", "status");
    root.append(style, mascotEl, bubble);
    document.documentElement.append(host);

    const speak = (t) => {
        bubble.textContent = t;
        bubble.classList.add("show");
    };
    const vw = () => innerWidth;
    const vh = () => innerHeight;
    const W = 124;
    const H = W * (100 / 120);

    // ---------- cutoff ----------
    if (mode === "cutoff") {
        const shade = document.createElement("div");
        shade.className = "shade";
        root.insertBefore(shade, mascotEl);
        host.style.pointerEvents = "auto";
        setFace("stern");
        const cx = vw() / 2 - W / 2;
        const cy = vh() / 2 - H / 2;
        mascotEl.style.left = "0px";
        mascotEl.style.top = "0px";
        mascotEl.style.cursor = "default";
        bubble.className = "bubble tail-down";
        const placeBubble = () => {
            bubble.style.left = `${vw() / 2 - bubble.offsetWidth / 2}px`;
            bubble.style.top = `${cy - 40 - bubble.offsetHeight}px`;
        };
        requestAnimationFrame(() => (shade.style.opacity = "0.6"));
        if (reduce) {
            mascotEl.style.transform = `translate(${cx}px, ${cy}px) scale(1.5)`;
            speak(text);
            placeBubble();
        } else {
            mascotEl.animate(
                [
                    { transform: `translate(${cx}px, ${vh() + 20}px) scale(1.5)` },
                    { transform: `translate(${cx}px, ${cy - 90}px) scale(1.35, 1.65)`, offset: 0.55 },
                    { transform: `translate(${cx}px, ${cy}px) scale(1.75, 1.3)`, offset: 0.85 },
                    { transform: `translate(${cx}px, ${cy}px) scale(1.5)` }
                ],
                { duration: 520, easing: "ease-out", fill: "forwards" }
            ).onfinish = () => {
                speak(text);
                placeBubble();
            };
        }
        setTimeout(() => {
            shade.style.transition = "opacity 0.35s ease-in";
            shade.style.opacity = "1";
        }, 1150);
        return;
    }

    // ---------- peek ----------
    setFace("smug");
    let peekY = vh() - H * 0.86;
    let peekX = vw() - W - 28;
    const place = (x, y, rot = 0) => (mascotEl.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`);
    const placeBubble = (x, y) => {
        bubble.className = "bubble tail-right show";
        bubble.style.left = `${Math.max(8, x - bubble.offsetWidth - 16)}px`;
        bubble.style.top = `${Math.max(8, y + H * 0.2 - bubble.offsetHeight / 2)}px`;
    };
    let pos = { x: peekX, y: vh() + 10 };
    place(pos.x, pos.y);
    let closeTimer;
    let gone = false;

    const remove = () => {
        if (gone) return;
        gone = true;
        clearTimeout(closeTimer);
        host.remove();
    };
    const duck = () => {
        bubble.classList.remove("show");
        if (reduce) return remove();
        mascotEl.animate([{ transform: mascotEl.style.transform }, { transform: `translate(${pos.x}px, ${vh() + 10}px)` }], { duration: 380, easing: "ease-in", fill: "forwards" }).onfinish = remove;
    };
    const armClose = (ms = 8000) => {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(duck, ms);
    };

    const rise = () => {
        pos = { x: peekX, y: peekY };
        const done = () => {
            place(pos.x, pos.y);
            speak(text);
            placeBubble(pos.x, pos.y);
            armClose();
        };
        if (reduce) return done();
        mascotEl.animate(
            [
                { transform: `translate(${peekX}px, ${vh() + 10}px)` },
                { transform: `translate(${peekX}px, ${peekY - 14}px) scale(0.94, 1.08)`, offset: 0.7 },
                { transform: `translate(${peekX}px, ${peekY}px)` }
            ],
            { duration: 460, easing: "ease-out" }
        ).onfinish = done;
    };
    rise();

    // tap = one status fact from the extension; drag = carry; throw = dismiss
    let facts = null;
    let factIndex = 0;
    const statusTap = async () => {
        armClose();
        try {
            if (!facts) {
                const res = await chrome.runtime.sendMessage({ action: "statusFacts" });
                facts = res?.ok ? [...res.urgent, ...res.other] : [];
            }
        } catch {
            facts = [];
        }
        speak(facts.length ? facts[factIndex++ % facts.length] : "Still here. Still counting.");
        placeBubble(pos.x, pos.y);
    };

    let drag = null;
    mascotEl.addEventListener("pointerdown", (e) => {
        drag = { sx: e.clientX, sy: e.clientY, ox: e.clientX - pos.x, oy: e.clientY - pos.y, samples: [], moved: false };
        mascotEl.setPointerCapture(e.pointerId);
        clearTimeout(closeTimer);
    });
    mascotEl.addEventListener("pointermove", (e) => {
        if (!drag) return;
        drag.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
        if (drag.samples.length > 10) drag.samples.shift();
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
            drag.moved = true;
            mascotEl.classList.add("dragging");
            setFace("surprised");
            bubble.classList.remove("show");
        }
        if (drag.moved) {
            pos = { x: e.clientX - drag.ox, y: e.clientY - drag.oy };
            place(pos.x, pos.y, Math.max(-20, Math.min(20, (e.movementX || 0) * 2)));
        }
    });
    const end = (e) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        mascotEl.classList.remove("dragging");
        if (!d.moved) return statusTap();
        const last = d.samples[d.samples.length - 1] || { x: e.clientX, y: e.clientY, t: e.timeStamp };
        let first = d.samples[0] || last;
        for (const s of d.samples) if (last.t - s.t <= 100) { first = s; break; }
        const dt = Math.max(1, last.t - first.t) / 1000;
        const vx = (last.x - first.x) / dt;
        const vy = (last.y - first.y) / dt;
        if (Math.hypot(vx, vy) > 1500) {
            // thrown: fly off, offended, and stay gone
            setFace("angry");
            if (reduce) return remove();
            mascotEl.animate(
                [{ transform: mascotEl.style.transform, opacity: 1 }, { transform: `translate(${pos.x + vx * 0.45}px, ${pos.y + vy * 0.45}px) rotate(${vx >= 0 ? 540 : -540}deg)`, opacity: 0 }],
                { duration: 450, easing: "cubic-bezier(0.2, 0.6, 0.4, 1)", fill: "forwards" }
            ).onfinish = remove;
            return;
        }
        // dropped: slide back to the peek spot, grumbling
        setFace("smug");
        const from = mascotEl.style.transform;
        pos = { x: peekX, y: peekY };
        const back = () => {
            place(pos.x, pos.y);
            speak("Hmph. I'm watching from here.");
            placeBubble(pos.x, pos.y);
            armClose(5000);
        };
        if (reduce) return back();
        mascotEl.animate([{ transform: from }, { transform: `translate(${pos.x}px, ${pos.y}px)` }], { duration: 420, easing: "ease-out" }).onfinish = back;
    };
    mascotEl.addEventListener("pointerup", end);
    mascotEl.addEventListener("pointercancel", end);
    mascotEl.addEventListener("pointerenter", () => clearTimeout(closeTimer));
    mascotEl.addEventListener("pointerleave", () => !drag && armClose(4000));

    addEventListener("resize", () => {
        if (gone || drag) return;
        peekY = vh() - H * 0.86;
        peekX = vw() - W - 28;
        pos = { x: peekX, y: peekY };
        place(pos.x, pos.y);
        if (bubble.classList.contains("show")) placeBubble(pos.x, pos.y);
    });
}
