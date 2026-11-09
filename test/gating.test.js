import { test } from "node:test";
import assert from "node:assert/strict";
import { requestSettingChange, resolvePending, isLoosening } from "../lib/gating.js";
import { DEFAULT_SETTINGS, HOUR_MS } from "../lib/defaults.js";

const NOW = 5_000_000;
const settings = { ...DEFAULT_SETTINGS };

test("isLoosening per key direction", () => {
    assert.ok(isLoosening("pauseWaitSec", 180, 60));
    assert.ok(!isLoosening("pauseWaitSec", 180, 300));
    assert.ok(isLoosening("pauseCapMin", 30, 60));
    assert.ok(isLoosening("coolOffHours", 12, 6));
    assert.ok(!isLoosening("blockAction", "page", "close"));
});

test("tightening applies instantly", () => {
    const r = requestSettingChange(settings, [], "pauseWaitSec", 300, NOW);
    assert.equal(r.status, "applied");
    assert.equal(r.settings.pauseWaitSec, 300);
});

test("loosening is refused while settings are locked", () => {
    const r = requestSettingChange(settings, [], "pauseCapMin", 60, NOW);
    assert.equal(r.status, "locked");
    assert.equal(r.settings.pauseCapMin, 30);
    assert.equal(requestSettingChange(settings, [], "coolOffHours", 1, NOW).status, "locked");
    assert.equal(requestSettingChange(settings, [], "watchCooldownMin", 10, NOW).status, "locked");
});

test("loosening applies once unlocked", () => {
    const r = requestSettingChange(settings, [], "coolOffHours", 1, NOW, { unlocked: true });
    assert.equal(r.status, "applied");
    assert.equal(r.settings.coolOffHours, 1);
});

test("tightening clears an old pending change for that key", () => {
    const pending = [{ key: "pauseCapMin", value: 60, effectiveAt: NOW + HOUR_MS }];
    const tight = requestSettingChange(settings, pending, "pauseCapMin", 15, NOW);
    assert.equal(tight.status, "applied");
    assert.equal(tight.pending.length, 0);
    assert.equal(tight.settings.pauseCapMin, 15);
});

test("values are clamped to limits", () => {
    const r = requestSettingChange(settings, [], "coolOffHours", 999, NOW);
    assert.equal(r.settings.coolOffHours, 24);
    assert.equal(requestSettingChange(settings, [], "pauseWaitSec", "abc", NOW).status, "invalid");
    assert.equal(requestSettingChange(settings, [], "nope", 1, NOW).status, "invalid");
});

test("blockAction is free and validated", () => {
    assert.equal(requestSettingChange(settings, [], "blockAction", "close", NOW).status, "applied");
    assert.equal(requestSettingChange(settings, [], "blockAction", "explode", NOW).status, "invalid");
});

test("resolvePending applies due changes only", () => {
    const pending = [
        { key: "pauseCapMin", value: 60, effectiveAt: NOW },
        { key: "coolOffHours", value: 2, effectiveAt: NOW + 1 }
    ];
    const r = resolvePending(settings, pending, NOW);
    assert.equal(r.settings.pauseCapMin, 60);
    assert.equal(r.settings.coolOffHours, 12);
    assert.equal(r.pending.length, 1);
    assert.ok(r.changed);
});

test("soundOn is a free boolean", () => {
    assert.equal(requestSettingChange(settings, [], "soundOn", true, NOW).settings.soundOn, true);
    assert.equal(requestSettingChange(settings, [], "soundOn", "yes", NOW).status, "invalid");
    assert.equal(requestSettingChange(settings, [], "mascotStill", true, NOW).status, "applied");
});
