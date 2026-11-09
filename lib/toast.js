// Injected into a Watched page with chrome.scripting.executeScript({ func: showToast }).
// Must stay self-contained: no imports, no outer variables. Display-only, reads nothing.
// Drawn in the mascot's line art with its own fixed palette (the host page's CSS can't reach it).
export function showToast(title, text) {
    const HOST_ID = "tab-sniper-toast-host";
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all: initial; position: fixed; right: 18px; bottom: 18px; z-index: 2147483647;";
    const root = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
        .toast {
            font: 600 14px/1.4 "M PLUS Rounded 1c", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif;
            display: flex;
            gap: 12px;
            align-items: center;
            max-width: 360px;
            padding: 10px 12px 10px 10px;
            background: #c9c3d6;
            color: #221f29;
            border: 3px solid #221f29;
            border-radius: 18px;
            box-shadow: 0 5px 0 #221f29;
            animation: in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .face { width: 76px; flex: none; display: block; }
        .bubble {
            background: #fdfcff;
            border: 2.5px solid #221f29;
            border-radius: 14px;
            padding: 8px 12px;
        }
        .title { font-weight: 800; font-size: 15px; margin-bottom: 1px; }
        button {
            all: unset;
            cursor: pointer;
            align-self: flex-start;
            width: 22px; height: 22px;
            display: grid; place-items: center;
            border-radius: 50%;
            border: 2.5px solid #221f29;
            background: #f2e8ca;
        }
        button:focus-visible { outline: 3px solid #5c6688; outline-offset: 2px; }
        button svg { width: 10px; height: 10px; }
        @keyframes in { from { transform: translateY(20px) scale(0.9); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
    `;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
        <svg class="face" viewBox="0 0 120 100" aria-hidden="true">
            <rect x="4" y="4" width="112" height="92" rx="18" fill="#c9c3d6"/>
            <path d="M 4 30 L 4 22 Q 4 4 22 4 L 98 4 Q 116 4 116 22 L 116 30 Z" fill="#f2e8ca"/>
            <path d="M 4 30 L 116 30" stroke="#221f29" stroke-width="3"/>
            <rect x="4" y="4" width="112" height="92" rx="18" fill="none" stroke="#221f29" stroke-width="4"/>
            <circle cx="20" cy="17" r="5.2" fill="#ee93ab" stroke="#221f29" stroke-width="2.6"/>
            <circle cx="35" cy="17" r="5.2" fill="#5c6688" stroke="#221f29" stroke-width="2.6"/>
            <rect x="14" y="36" width="92" height="50" rx="11" fill="#3a3743" stroke="#221f29" stroke-width="3.2"/>
            <ellipse cx="31" cy="71" rx="6" ry="3.4" fill="#ee93ab"/>
            <ellipse cx="89" cy="71" rx="6" ry="3.4" fill="#ee93ab"/>
            <g fill="#141218"><ellipse cx="44" cy="60" rx="8.4" ry="9.4"/><ellipse cx="76" cy="60" rx="8.4" ry="9.4"/></g>
            <g fill="#3a3743"><rect x="33" y="48" width="22" height="11.4"/><rect x="65" y="48" width="22" height="11.4"/></g>
            <g fill="#fdfcff"><circle cx="41.2" cy="62" r="2.4"/><circle cx="73.2" cy="62" r="2.4"/></g>
            <path d="M 34.6 59.4 L 53.4 59.4 M 66.6 59.4 L 85.4 59.4" stroke="#141218" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M 53.5 71.6 Q 61.5 74.6 67.5 67.6" fill="none" stroke="#141218" stroke-width="2.6" stroke-linecap="round"/>
        </svg>`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const t = document.createElement("div");
    t.className = "title";
    t.textContent = title;
    const p = document.createElement("div");
    p.textContent = text;
    bubble.append(t, p);
    const close = document.createElement("button");
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="#221f29" stroke-width="2" stroke-linecap="round"/></svg>';
    close.addEventListener("click", () => host.remove());
    toast.append(bubble, close);

    root.append(style, toast);
    document.documentElement.append(host);
    setTimeout(() => host.remove(), 10000);
}
