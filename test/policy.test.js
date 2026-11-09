import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, activeBlocks, bansActive } from "../lib/policy.js";
import { DEFAULT_SETTINGS } from "../lib/defaults.js";

const NOW = 1_000_000;
const base = (overrides = {}) => ({
    enabled: false,
    timer: null,
    bans: ["reddit.com"],
    superBans: [{ domain: "instagram.com" }],
    pauses: {},
    settings: { ...DEFAULT_SETTINGS },
    ...overrides
});

test("super ban blocks even when toggle is off", () => {
    const d = decide("https://www.instagram.com/reels/", base(), NOW);
    assert.deepEqual(d, { action: "block", category: "super", domain: "instagram.com" });
});

test("paused super ban allows until pause ends", () => {
    const state = base({ pauses: { "instagram.com": { until: NOW + 1 } } });
    assert.equal(decide("https://instagram.com", state, NOW).action, "allow");
    assert.equal(decide("https://instagram.com", state, NOW + 1).action, "block");
});

test("normal ban only while enabled or focus running", () => {
    assert.equal(decide("https://reddit.com", base(), NOW).action, "allow");
    assert.equal(decide("https://reddit.com", base({ enabled: true }), NOW).action, "block");
    const timer = { active: true, endTime: NOW + 1000 };
    assert.equal(decide("https://reddit.com", base({ timer }), NOW).action, "block");
    assert.equal(decide("https://reddit.com", base({ timer }), NOW + 1000).action, "allow");
});

test("close-tab setting only affects normal bans", () => {
    const state = base({ enabled: true, settings: { ...DEFAULT_SETTINGS, blockAction: "close" } });
    assert.equal(decide("https://reddit.com", state, NOW).action, "close");
    assert.equal(decide("https://instagram.com", state, NOW).action, "block");
});

test("non-web urls are allowed", () => {
    assert.equal(decide("chrome://extensions", base({ enabled: true }), NOW).action, "allow");
});

test("activeBlocks: super first, bans when active, none for close mode", () => {
    assert.deepEqual(activeBlocks(base(), NOW), [{ domain: "instagram.com", category: "super" }]);
    assert.deepEqual(activeBlocks(base({ enabled: true }), NOW), [
        { domain: "instagram.com", category: "super" },
        { domain: "reddit.com", category: "ban" }
    ]);
    const close = base({ enabled: true, settings: { ...DEFAULT_SETTINGS, blockAction: "close" } });
    assert.deepEqual(activeBlocks(close, NOW), [{ domain: "instagram.com", category: "super" }]);
    const both = base({ enabled: true, bans: ["instagram.com"] });
    assert.deepEqual(activeBlocks(both, NOW), [{ domain: "instagram.com", category: "super" }]);
});

test("bansActive", () => {
    assert.equal(bansActive(base(), NOW), false);
    assert.equal(bansActive(base({ enabled: true }), NOW), true);
});
