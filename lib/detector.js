// Doomscroll detection for one Watched site. Inputs are focused+active time segments
// and URL changes; output is a warning (~80%) or a trip. No page content is read.
import { MINUTE_MS } from "./defaults.js";
import { PROFILES, isShortForm, swipeId } from "./profiles.js";

export const VISIT_GAP_MS = 5 * MINUTE_MS; // away this long = new visit
export const STREAK_BREAK_MS = 60 * 1000; // this long off short-form breaks the streak
export const MAX_SEGMENT_MS = 90 * 1000; // never credit more than this per segment
export const WARN_RATIO = 0.8;

export function emptyEntry() {
    return { visitMs: 0, streakMs: 0, offShortMs: 0, lastAt: 0, swipes: [], warned: {} };
}

function freshIfGap(entry, now) {
    if (!entry) return emptyEntry();
    if (entry.lastAt && now - entry.lastAt > VISIT_GAP_MS) return emptyEntry();
    return entry;
}

// Credit active time [from, to) spent on `url`.
export function accrue(entry, watched, url, from, to) {
    const e = { ...freshIfGap(entry, from) };
    const dt = Math.min(MAX_SEGMENT_MS, Math.max(0, to - from));
    e.visitMs += dt;
    e.lastAt = to;
    if (isShortForm(watched, url)) {
        e.streakMs += dt;
        e.offShortMs = 0;
    } else {
        e.offShortMs += dt;
        if (e.offShortMs >= STREAK_BREAK_MS) e.streakMs = 0;
    }
    return e;
}

// Count a distinct short video opened at `now`.
export function recordNav(entry, watched, url, now) {
    const id = swipeId(watched, url);
    if (!id) return entry || emptyEntry();
    const e = { ...freshIfGap(entry, now) };
    const windowMs = (watched.swipeWindowMin || 10) * MINUTE_MS;
    const swipes = e.swipes.filter((s) => now - s.at < windowMs);
    if (!swipes.some((s) => s.id === id)) swipes.push({ id, at: now });
    e.swipes = swipes;
    return e;
}

export function swipesInWindow(entry, watched, now) {
    const windowMs = (watched.swipeWindowMin || 10) * MINUTE_MS;
    return (entry?.swipes || []).filter((s) => now - s.at < windowMs).length;
}

// Current usage against each limit that applies to this site.
export function measure(entry, watched, now) {
    const e = entry || emptyEntry();
    const out = [{ kind: "visit", used: e.visitMs / MINUTE_MS, limit: watched.visitLimitMin }];
    if (PROFILES[watched.profile] && watched.streakLimitMin) {
        out.push({ kind: "streak", used: e.streakMs / MINUTE_MS, limit: watched.streakLimitMin });
    }
    if (PROFILES[watched.profile]?.swipe && watched.swipeLimit) {
        out.push({ kind: "swipes", used: swipesInWindow(e, watched, now), limit: watched.swipeLimit });
    }
    return out;
}

export function describe(kind, watched, used, limit, { trip }) {
    const noun = PROFILES[watched.profile]?.noun || "short-form";
    const u = Math.floor(used);
    if (kind === "visit") {
        return trip ? `${limit} min straight on ${watched.domain}` : `${u} of ${limit} min used this visit on ${watched.domain}`;
    }
    if (kind === "streak") {
        return trip ? `${limit} min of ${noun} in a row` : `${u} of ${limit} min of ${noun} in a row`;
    }
    return trip
        ? `${limit} ${noun} in ${watched.swipeWindowMin} min`
        : `${u} of ${limit} ${noun} in ${watched.swipeWindowMin} min`;
}

// -> { entry, trip: {kind, text} | null, warn: {kind, text} | null }
// Each kind warns once per visit.
export function evaluate(entry, watched, now) {
    const e = entry || emptyEntry();
    const usage = measure(e, watched, now);
    const tripped = usage.find((m) => m.used >= m.limit);
    if (tripped) {
        return {
            entry: e,
            trip: { kind: tripped.kind, text: describe(tripped.kind, watched, tripped.used, tripped.limit, { trip: true }) },
            warn: null
        };
    }
    const warnable = usage
        .filter((m) => m.used >= m.limit * WARN_RATIO && !e.warned?.[m.kind])
        .sort((a, b) => b.used / b.limit - a.used / a.limit)[0];
    if (!warnable) return { entry: e, trip: null, warn: null };
    return {
        entry: { ...e, warned: { ...e.warned, [warnable.kind]: true } },
        trip: null,
        warn: { kind: warnable.kind, text: describe(warnable.kind, watched, warnable.used, warnable.limit, { trip: false }) }
    };
}
