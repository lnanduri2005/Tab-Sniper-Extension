// Rolling 30-day activity log: { [dayKey]: { attempts: {domain: n}, trips: {domain: n}, pauses: {domain: min}, focusMin: n } }
import { dayKey } from "./day.js";

export const KEEP_DAYS = 30;

export function lastDays(today = new Date(), n = KEEP_DAYS) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        out.push(dayKey(d));
    }
    return out;
}

export function logEvent(log, day, field, key, amount = 1) {
    const entry = { attempts: {}, trips: {}, pauses: {}, focusMin: 0, ...(log?.[day] || {}) };
    if (field === "focusMin") {
        entry.focusMin = (entry.focusMin || 0) + amount;
    } else {
        entry[field] = { ...(entry[field] || {}), [key]: ((entry[field] || {})[key] || 0) + amount };
    }
    return { ...(log || {}), [day]: entry };
}

export function pruneLog(log, today = new Date()) {
    const keep = new Set(lastDays(today));
    const out = {};
    for (const [day, entry] of Object.entries(log || {})) if (keep.has(day)) out[day] = entry;
    return out;
}

const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);

export function summarize(log, today = new Date()) {
    const days = lastDays(today);
    const series = days.map((day) => ({
        day,
        attempts: sum(log?.[day]?.attempts),
        trips: sum(log?.[day]?.trips),
        pauses: sum(log?.[day]?.pauses),
        focusMin: log?.[day]?.focusMin || 0
    }));
    const totals = {};
    for (const day of days) {
        for (const [domain, n] of Object.entries(log?.[day]?.attempts || {})) totals[domain] = (totals[domain] || 0) + n;
    }
    const topSites = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const week = (from, to) => series.slice(from, to).reduce((a, d) => a + d.attempts, 0);
    const thisWeek = week(-7);
    const lastWeek = week(-14, -7);
    const change = lastWeek === 0 ? null : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    return {
        series,
        topSites,
        thisWeek,
        lastWeek,
        change,
        focusThisWeek: series.slice(-7).reduce((a, d) => a + d.focusMin, 0),
        tripsThisWeek: series.slice(-7).reduce((a, d) => a + d.trips, 0),
        pausesThisWeek: series.slice(-7).reduce((a, d) => a + d.pauses, 0),
        total30: series.reduce((a, d) => a + d.attempts, 0)
    };
}

// "none" | "down" | "up" | "flat" | "first"
export function trend({ thisWeek, lastWeek, total30 }) {
    if (!total30) return "none";
    if (!lastWeek) return "first";
    if (thisWeek < lastWeek * 0.85) return "down";
    if (thisWeek > lastWeek * 1.15) return "up";
    return "flat";
}
