// Export / import of a Tab Sniper setup as a plain JSON file, so moving between computers
// never needs Chrome sync. Import only ever adds sites; settings that would make protection
// easier are applied only while Settings is unlocked.
import { normalizeDomain } from "./match.js";
import { PROFILES, newWatchedEntry, clampWatchField } from "./profiles.js";
import { requestSettingChange } from "./gating.js";

export const BACKUP_APP = "tab-sniper";
export const BACKUP_VERSION = 1;

export function buildBackup(state, now = Date.now()) {
    return {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: new Date(now).toISOString(),
        bans: [...state.bans],
        superBans: state.superBans.map((s) => s.domain),
        watched: state.watched.map((w) => ({ ...w })),
        presets: state.presets.map(({ name, minutes }) => ({ name, minutes })),
        settings: { ...state.settings }
    };
}

// -> { ok, error?, next: { bans, superBans, watched, presets, settings, pendingSettings }, summary }
export function applyBackup(state, data, now = Date.now(), { unlocked = false } = {}) {
    if (!data || data.app !== BACKUP_APP || typeof data.version !== "number") {
        return { ok: false, error: "That file isn't a Tab Sniper backup." };
    }
    const summary = { bans: 0, superBans: 0, watched: 0, presets: 0, settings: 0, settingsSkipped: 0 };

    const bans = [...state.bans];
    for (const raw of data.bans || []) {
        const d = normalizeDomain(raw);
        if (d && !bans.includes(d)) { bans.push(d); summary.bans++; }
    }

    const superBans = [...state.superBans];
    for (const raw of data.superBans || []) {
        const d = normalizeDomain(typeof raw === "string" ? raw : raw?.domain);
        if (d && !superBans.some((s) => s.domain === d)) { superBans.push({ domain: d, addedAt: now }); summary.superBans++; }
    }

    const watched = [...state.watched];
    for (const w of data.watched || []) {
        const d = normalizeDomain(w?.domain);
        if (!d || watched.some((x) => x.domain === d)) continue;
        const profile = PROFILES[w.profile] && PROFILES[w.profile].domain === d ? w.profile : null;
        const entry = newWatchedEntry(profile ? { profile } : { domain: d });
        for (const key of ["visitLimitMin", "streakLimitMin", "swipeLimit", "swipeWindowMin"]) {
            if (key in entry && w[key] != null) {
                const v = clampWatchField(key, w[key]);
                if (v !== null) entry[key] = v;
            }
        }
        watched.push(entry);
        summary.watched++;
    }

    const presets = [...state.presets];
    for (const p of data.presets || []) {
        const minutes = Math.round(Number(p?.minutes));
        const name = String(p?.name || "").trim().slice(0, 40);
        if (!name || !(minutes >= 1 && minutes <= 240)) continue;
        if (presets.some((x) => x.name === name && x.minutes === minutes)) continue;
        presets.push({ id: now + presets.length, name, minutes });
        summary.presets++;
    }

    let settings = { ...state.settings };
    let pendingSettings = [...state.pendingSettings];
    for (const [key, value] of Object.entries(data.settings || {})) {
        if (!(key in settings) || value === settings[key]) continue;
        const r = requestSettingChange(settings, pendingSettings, key, value, now, { unlocked });
        if (r.status === "applied") { settings = r.settings; pendingSettings = r.pending; summary.settings++; }
        else if (r.status === "locked") summary.settingsSkipped++;
    }

    return { ok: true, next: { bans, superBans, watched, presets, settings, pendingSettings }, summary };
}
