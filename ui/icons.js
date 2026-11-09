// Small line icons drawn to match the mascot: 24px grid, 2.2 stroke, round caps.
const wrap = (body) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
    lock: wrap('<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    eye: wrap('<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    ban: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M6 18 18 6"/>'),
    gear: wrap('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.3"/><circle cx="9" cy="17" r="2.3"/>'),
    plus: wrap('<path d="M12 5v14M5 12h14"/>'),
    play: wrap('<path d="M8 5.5v13l10-6.5z"/>'),
    stop: wrap('<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>'),
    x: wrap('<path d="M6 6l12 12M18 6 6 18"/>'),
    clock: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    pause: wrap('<path d="M9 6v12M15 6v12"/>'),
    arrow: wrap('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    back: wrap('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    sun: wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    moon: wrap('<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>'),
    sound: wrap('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    chart: wrap('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>')
};

export function icon(name) {
    const span = document.createElement("span");
    span.className = "icon";
    span.innerHTML = ICONS[name] || "";
    return span;
}
