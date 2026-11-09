// Injected into a Watched page with chrome.scripting.executeScript({ func: showToast }).
// Must stay self-contained: no imports, no outer variables. Display-only, reads nothing.
export function showToast(title, text) {
    const HOST_ID = "tab-sniper-toast-host";
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;";
    const root = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
        .toast {
            font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            max-width: 320px;
            padding: 12px 14px;
            border-radius: 12px;
            background: #2B1B2E;
            color: #F2EEF5;
            border: 1px solid #6B4B80;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
            display: flex;
            gap: 10px;
            align-items: flex-start;
            animation: in 0.2s ease-out;
        }
        .title { font-weight: 700; margin-bottom: 2px; }
        button {
            all: unset;
            cursor: pointer;
            color: #CDB8D6;
            font-size: 16px;
            line-height: 1;
            padding: 2px 4px;
        }
        @keyframes in { from { transform: translateY(8px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
    `;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    const body = document.createElement("div");
    const t = document.createElement("div");
    t.className = "title";
    t.textContent = title;
    const p = document.createElement("div");
    p.textContent = text;
    body.append(t, p);
    const close = document.createElement("button");
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.addEventListener("click", () => host.remove());
    toast.append(body, close);

    root.append(style, toast);
    document.documentElement.append(host);
    setTimeout(() => host.remove(), 10000);
}
