// Page-side helpers for talking to the service worker.

export function send(action, payload = {}) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action, ...payload }, (response) => {
            if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message });
                return;
            }
            resolve(response || { ok: false, error: "No response" });
        });
    });
}

export function formatDuration(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatClock(timestamp) {
    return new Date(timestamp).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
