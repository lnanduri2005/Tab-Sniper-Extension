// Built-in Watched profiles. Path patterns run against URL pathname.
// shortForm: surfaces with stricter "in a row" limits. swipe: captures one item id per short video.
import { extractDomain, domainMatches } from "./match.js";

export const PROFILES = {
    youtube: {
        label: "YouTube",
        domain: "youtube.com",
        noun: "Shorts",
        shortForm: ["^/shorts(/|$)"],
        swipe: "^/shorts/([^/?#]+)"
    },
    instagram: {
        label: "Instagram",
        domain: "instagram.com",
        noun: "Reels",
        shortForm: ["^/reels?(/|$)", "^/explore(/|$)"],
        swipe: "^/reels?/([^/?#]+)"
    },
    tiktok: {
        label: "TikTok",
        domain: "tiktok.com",
        noun: "TikToks",
        shortForm: ["^/$", "^/foryou", "^/following", "^/explore", "^/@[^/]+/video/"],
        swipe: "^/@[^/]+/video/(\\d+)"
    },
    x: {
        label: "X / Twitter",
        domain: "x.com",
        noun: "feed",
        shortForm: ["^/home", "^/explore", "^/i/trending"],
        swipe: null
    },
    reddit: {
        label: "Reddit",
        domain: "reddit.com",
        noun: "feed",
        shortForm: ["^/$", "^/(best|hot|new|top|rising)/?$", "^/r/(all|popular)(/|$)", "^/r/[^/]+/?$"],
        swipe: null
    },
    facebook: {
        label: "Facebook",
        domain: "facebook.com",
        noun: "Reels",
        shortForm: ["^/$", "^/reel/", "^/watch"],
        swipe: "^/reel/(\\d+)"
    }
};

export const WATCH_DEFAULTS = Object.freeze({
    visitLimitMin: 15,
    streakLimitMin: 8,
    swipeLimit: 25,
    swipeWindowMin: 10
});

export const WATCH_LIMITS = Object.freeze({
    visitLimitMin: { min: 1, max: 120 },
    streakLimitMin: { min: 1, max: 60 },
    swipeLimit: { min: 5, max: 200 },
    swipeWindowMin: { min: 1, max: 60 }
});

export function newWatchedEntry({ profile = null, domain }) {
    const base = { domain, profile, visitLimitMin: WATCH_DEFAULTS.visitLimitMin };
    if (!profile) return base;
    const p = PROFILES[profile];
    return {
        ...base,
        domain: p.domain,
        streakLimitMin: WATCH_DEFAULTS.streakLimitMin,
        ...(p.swipe ? { swipeLimit: WATCH_DEFAULTS.swipeLimit, swipeWindowMin: WATCH_DEFAULTS.swipeWindowMin } : {})
    };
}

export function clampWatchField(key, value) {
    const limits = WATCH_LIMITS[key];
    const num = Math.round(Number(value));
    if (!limits || !Number.isFinite(num)) return null;
    return Math.min(limits.max, Math.max(limits.min, num));
}

function pathOf(url) {
    try {
        return new URL(url).pathname;
    } catch {
        return "";
    }
}

export function isShortForm(entry, url) {
    const p = PROFILES[entry.profile];
    if (!p) return false;
    const path = pathOf(url);
    return p.shortForm.some((re) => new RegExp(re).test(path));
}

export function swipeId(entry, url) {
    const p = PROFILES[entry.profile];
    if (!p?.swipe) return null;
    const m = pathOf(url).match(new RegExp(p.swipe));
    return m ? m[1] : null;
}

export function findWatched(watched, url) {
    const host = extractDomain(url);
    if (!host) return null;
    return (watched || []).find((w) => domainMatches(host, w.domain)) || null;
}
