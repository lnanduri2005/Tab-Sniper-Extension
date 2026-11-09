// v1 -> v2 storage. v1 kept everything in sync (blockedUrls, timer*, history, stats).
// v2: config in sync, runtime/history in local.
import { DEFAULT_SETTINGS } from "./defaults.js";
import { normalizeDomain } from "./match.js";

export const SCHEMA_VERSION = 2;

export const V1_SYNC_KEYS = [
    "blockedUrls",
    "timerActive",
    "timerEndTime",
    "timerStartTime",
    "timerDurationMinutes",
    "currentSessionId",
    "history",
    "stats",
    "lastResetWeek"
];

export function ensureStatsShape(stats) {
    const dailyMinutes = Array.isArray(stats?.dailyMinutes) && stats.dailyMinutes.length === 7
        ? stats.dailyMinutes
        : [0, 0, 0, 0, 0, 0, 0];
    return { dailyMinutes, blockedSites: stats?.blockedSites || {} };
}

// -> null when already migrated, else { syncSet, syncRemove, localSet }
export function migrate(sync, local, now) {
    if ((local.schemaVersion || 0) >= SCHEMA_VERSION) return null;

    const bans = Array.from(
        new Set([...(sync.bans || []), ...(sync.blockedUrls || [])].map(normalizeDomain).filter(Boolean))
    );

    const timer = sync.timerActive && sync.timerEndTime > now
        ? {
            active: true,
            startTime: sync.timerStartTime || now,
            endTime: sync.timerEndTime,
            durationMinutes: sync.timerDurationMinutes || 1,
            sessionId: sync.currentSessionId || null
        }
        : null;

    return {
        syncSet: {
            enabled: !!sync.enabled,
            bans,
            superBans: sync.superBans || [],
            settings: { ...DEFAULT_SETTINGS, ...(sync.settings || {}) },
            pendingSettings: sync.pendingSettings || [],
            removals: sync.removals || {},
            challengeLocks: sync.challengeLocks || {},
            presets: (sync.presets || []).map(({ id, name, minutes }) => ({ id, name, minutes }))
        },
        syncRemove: V1_SYNC_KEYS,
        localSet: {
            schemaVersion: SCHEMA_VERSION,
            timer: local.timer || timer,
            history: local.history || (sync.history || []).slice(0, 200),
            stats: ensureStatsShape(local.stats || sync.stats),
            lastResetWeek: local.lastResetWeek || sync.lastResetWeek || null,
            pauses: local.pauses || {},
            pauseRequests: local.pauseRequests || {},
            pauseUsage: local.pauseUsage || {},
            attempts: local.attempts || {}
        }
    };
}
