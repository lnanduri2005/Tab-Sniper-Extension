import { test } from "node:test";
import assert from "node:assert/strict";

import { lateNightHour } from "../ui/voice.js";

test("mascot notices the hour only between midnight and 5am", () => {
    const at = (h) => new Date(2026, 10, 8, h, 30);
    assert.equal(lateNightHour(at(0)), "12am");
    assert.equal(lateNightHour(at(1)), "1am");
    assert.equal(lateNightHour(at(4)), "4am");
    assert.equal(lateNightHour(at(5)), null);
    assert.equal(lateNightHour(at(23)), null);
});
