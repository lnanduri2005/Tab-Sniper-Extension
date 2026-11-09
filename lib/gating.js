// Loosening a super-ban setting only takes effect after the current cool-off.
// Tightening applies instantly and cancels any pending loosening for that key.
import { SETTING_LIMITS, HOUR_MS } from "./defaults.js";

const LOOSENS = {
    pauseWaitSec: (oldValue, newValue) => newValue < oldValue,
    pauseCapMin: (oldValue, newValue) => newValue > oldValue,
    coolOffHours: (oldValue, newValue) => newValue < oldValue
};

export function isLoosening(key, oldValue, newValue) {
    const check = LOOSENS[key];
    return check ? check(oldValue, newValue) : false;
}

export function clampSetting(key, value) {
    const limits = SETTING_LIMITS[key];
    if (!limits) return value;
    const num = Math.round(Number(value));
    if (!Number.isFinite(num)) return null;
    return Math.min(limits.max, Math.max(limits.min, num));
}

// -> { settings, pending, status: "applied" | "pending" | "unchanged" | "invalid", effectiveAt? }
export function requestSettingChange(settings, pending, key, rawValue, now) {
    if (!(key in settings)) return { settings, pending, status: "invalid" };
    const value = key === "blockAction"
        ? (rawValue === "close" ? "close" : rawValue === "page" ? "page" : null)
        : clampSetting(key, rawValue);
    if (value === null) return { settings, pending, status: "invalid" };

    const rest = pending.filter((p) => p.key !== key);
    if (value === settings[key]) return { settings, pending: rest, status: "unchanged" };

    if (isLoosening(key, settings[key], value)) {
        const effectiveAt = now + settings.coolOffHours * HOUR_MS;
        return {
            settings,
            pending: [...rest, { key, value, requestedAt: now, effectiveAt }],
            status: "pending",
            effectiveAt
        };
    }

    return { settings: { ...settings, [key]: value }, pending: rest, status: "applied" };
}

export function resolvePending(settings, pending, now) {
    let next = settings;
    const remaining = [];
    for (const change of pending) {
        if (change.effectiveAt <= now) next = { ...next, [change.key]: change.value };
        else remaining.push(change);
    }
    return { settings: next, pending: remaining, changed: remaining.length !== pending.length };
}
