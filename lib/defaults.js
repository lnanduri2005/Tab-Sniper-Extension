export const DEFAULT_SETTINGS = Object.freeze({
    blockAction: "page", // "page" | "close" (close applies to normal bans only)
    pauseWaitSec: 180,
    pauseCapMin: 30,
    coolOffHours: 12,
    soundOn: false
});

export const SETTING_LIMITS = Object.freeze({
    pauseWaitSec: { min: 60, max: 1800 },
    pauseCapMin: { min: 0, max: 240 },
    coolOffHours: { min: 1, max: 24 }
});

export const PAUSE_OPTIONS_MIN = Object.freeze([5, 10, 15]);

export const HOUR_MS = 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
