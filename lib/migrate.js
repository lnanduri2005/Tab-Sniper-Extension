// Storage migrations. Everything lives in chrome.storage.local; nothing syncs.
//   v1 (Web Store 1.x): everything in chrome.storage.sync (blockedUrls, timer*, history, stats)
//   v2 (early 2.0 builds): config in sync, runtime in local
//   v3: all local. Old sync data is read once, copied here, then the extension's sync area is cleared.
import { DEFAULT_SETTINGS } from "./defaults.js";
import { normalizeDomain } from "./match.js";

export const SCHEMA_VERSION = 3;

export const CONFIG_KEYS = ["enabled", "bans", "superBans", "watched", "settings", "pendingSettings", "removals", "challengeLocks", "presets"];

export function ensureStatsShape(stats) {
    const dailyMinutes = Array.isArray(stats?.dailyMinutes) && stats.dailyMinutes.length === 7
        ? stats.dailyMinutes
        : [0, 0, 0, 0, 0, 0, 0];
    return { dailyMinutes, blockedSites: stats?.blockedSites || {} };
}

// -> null when already on v3, else { localSet, clearSync: true }
export function migrate(sync, local, now) {
    if ((local.schemaVersion || 0) >= SCHEMA_VERSION) return null;

    // Config already in local wins over anything left in sync.
    const src = { ...sync };
    for (const key of CONFIG_KEYS) if (local[key] !== undefined) src[key] = local[key];

    const bans = Array.from(
        new Set([...(src.bans || []), ...(src.blockedUrls || [])].map(normalizeDomain).filter(Boolean))
    );

    const v1Timer = sync.timerActive && sync.timerEndTime > now
        ? {
            active: true,
            startTime: sync.timerStartTime || now,
            endTime: sync.timerEndTime,
            durationMinutes: sync.timerDurationMinutes || 1,
            sessionId: sync.currentSessionId || null
        }
        : null;

    return {
        localSet: {
            schemaVersion: SCHEMA_VERSION,
            enabled: !!src.enabled,
            bans,
            superBans: src.superBans || [],
            watched: src.watched || [],
            settings: { ...DEFAULT_SETTINGS, ...(src.settings || {}) },
            pendingSettings: src.pendingSettings || [],
            removals: src.removals || {},
            challengeLocks: src.challengeLocks || {},
            presets: (src.presets || []).map(({ id, name, minutes }) => ({ id, name, minutes })),
            timer: local.timer ?? v1Timer,
            history: local.history || (sync.history || []).slice(0, 200),
            stats: ensureStatsShape(local.stats || sync.stats),
            pauses: local.pauses || {},
            pauseRequests: local.pauseRequests || {},
            pauseUsage: local.pauseUsage || {},
            attempts: local.attempts || {}
        },
        clearSync: true
    };
}
