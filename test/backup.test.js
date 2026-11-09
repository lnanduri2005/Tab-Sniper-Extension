import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBackup, applyBackup } from "../lib/backup.js";
import { DEFAULT_SETTINGS } from "../lib/defaults.js";

const base = () => ({
    bans: ["reddit.com"],
    superBans: [{ domain: "instagram.com", addedAt: 1 }],
    watched: [{ domain: "youtube.com", profile: "youtube", visitLimitMin: 15, streakLimitMin: 8, swipeLimit: 25, swipeWindowMin: 10 }],
    presets: [{ id: 1, name: "Deep", minutes: 90 }],
    settings: { ...DEFAULT_SETTINGS },
    pendingSettings: []
});

test("export round-trips into an empty setup", () => {
    const file = buildBackup(base(), 0);
    assert.equal(file.app, "tab-sniper");
    const empty = { bans: [], superBans: [], watched: [], presets: [], settings: { ...DEFAULT_SETTINGS }, pendingSettings: [] };
    const r = applyBackup(empty, JSON.parse(JSON.stringify(file)), 5);
    assert.ok(r.ok);
    assert.deepEqual(r.next.bans, ["reddit.com"]);
    assert.deepEqual(r.next.superBans, [{ domain: "instagram.com", addedAt: 5 }]);
    assert.equal(r.next.watched[0].profile, "youtube");
    assert.equal(r.next.presets[0].name, "Deep");
    assert.deepEqual(r.summary, { bans: 1, superBans: 1, watched: 1, presets: 1, settings: 0, settingsSkipped: 0 });
});

test("import only adds; existing sites are kept, duplicates skipped", () => {
    const r = applyBackup(base(), { app: "tab-sniper", version: 1, bans: ["reddit.com", "www.X.com", "junk input"], superBans: ["instagram.com", "tiktok.com"] }, 0);
    assert.deepEqual(r.next.bans, ["reddit.com", "x.com"]);
    assert.deepEqual(r.next.superBans.map((s) => s.domain), ["instagram.com", "tiktok.com"]);
    assert.equal(r.summary.bans, 1);
    assert.equal(r.summary.superBans, 1);
});

test("easier settings are skipped while locked, stricter ones apply", () => {
    const data = { app: "tab-sniper", version: 1, settings: { pauseCapMin: 60, pauseWaitSec: 300, soundOn: true } };
    const locked = applyBackup(base(), data, 0);
    assert.equal(locked.next.settings.pauseCapMin, 30, "looser cap skipped");
    assert.equal(locked.next.settings.pauseWaitSec, 300, "longer wait is stricter");
    assert.equal(locked.next.settings.soundOn, true);
    assert.equal(locked.summary.settingsSkipped, 1);
    const open = applyBackup(base(), data, 0, { unlocked: true });
    assert.equal(open.next.settings.pauseCapMin, 60);
});

test("watched limits are clamped and fake profiles ignored", () => {
    const empty = { ...base(), watched: [] };
    const r = applyBackup(empty, { app: "tab-sniper", version: 1, watched: [{ domain: "youtube.com", profile: "youtube", visitLimitMin: 9999 }, { domain: "evil.com", profile: "youtube" }] }, 0);
    assert.equal(r.next.watched[0].visitLimitMin, 120);
    assert.equal(r.next.watched[1].profile, null, "profile must match its domain");
});

test("rejects files that aren't backups", () => {
    assert.equal(applyBackup(base(), { hello: 1 }).ok, false);
    assert.equal(applyBackup(base(), null).ok, false);
});
