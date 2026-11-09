import { ICONS } from "./icons.js";
import { el } from "./dom.js";

export const TIER_ICONS = { ban: ICONS.ban, watched: ICONS.eye, super: ICONS.lock };
export const TIER_NAMES = { ban: "Ban", watched: "Watched", super: "Super ban" };

export function tierChip(tier) {
    return el("span", { class: `tier ${tier}`, html: `${TIER_ICONS[tier]}<span>${TIER_NAMES[tier]}</span>` });
}

export function tierIcon(tier) {
    return el("span", { class: `tier icon-only ${tier}`, role: "img", "aria-label": TIER_NAMES[tier], title: TIER_NAMES[tier], html: TIER_ICONS[tier] });
}

export function iconButton(iconName, label, onclick, { disabled = false, title = null } = {}) {
    const b = el("button", { class: "icon-btn", "aria-label": label, title: title || label, html: ICONS[iconName], onclick });
    b.disabled = !!disabled;
    return b;
}
