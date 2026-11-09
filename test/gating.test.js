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

test("loosening waits the current cool-off", () => {
    const r = requestSettingChange(settings, [], "pauseCapMin", 60, NOW);
    assert.equal(r.status, "pending");
    assert.equal(r.settings.pauseCapMin, 30);
    assert.equal(r.effectiveAt, NOW + 12 * HOUR_MS);
});

test("lowering cool-off waits the old (longer) value", () => {
    const r = requestSettingChange(settings, [], "coolOffHours", 1, NOW);
    assert.equal(r.status, "pending");
    assert.equal(r.effectiveAt, NOW + 12 * HOUR_MS);
});

test("tightening cancels a pending loosening for that key", () => {
    const loose = requestSettingChange(settings, [], "pauseCapMin", 60, NOW);
    const tight = requestSettingChange(loose.settings, loose.pending, "pauseCapMin", 15, NOW);
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
