import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32 } from "../lib/rng.js";
import { buildPassage, checkTyping, TARGET_CHARS, SENTENCES } from "../challenges/typing.js";
import { makeProblem } from "../challenges/math.js";
import { newSequence, extendSequence, checkInput, PADS } from "../challenges/memory.js";
import {
    launch, stepBall, crossesBasketTop, isOut, oscillate, BASKET, ANGLE_RANGE
} from "../challenges/cannon.js";

test("typing passage reaches target length without repeats", () => {
    const passage = buildPassage(mulberry32(1), TARGET_CHARS.full);
    assert.ok(passage.join("").length >= TARGET_CHARS.full);
    assert.equal(new Set(passage).size, passage.length);
    assert.ok(passage.every((s) => SENTENCES.includes(s)));
});

test("checkTyping", () => {
    assert.equal(checkTyping("Hello there.", "Hello"), "progress");
    assert.equal(checkTyping("Hello there.", "Hellp"), "typo");
    assert.equal(checkTyping("Hello there.", "Hello there."), "done");
    assert.equal(checkTyping("Hello there.", "hello"), "typo", "case sensitive");
});

test("math problems are integer and self-consistent", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
        const p = makeProblem(rng);
        assert.ok(Number.isInteger(p.answer), p.text);
        const expr = p.text.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
        assert.equal(Function(`return ${expr}`)(), p.answer, p.text);
    }
});

test("memory sequence checking", () => {
    const rng = mulberry32(3);
    const seq = newSequence(rng, 3);
    assert.equal(seq.length, 3);
    assert.ok(seq.every((n) => n >= 0 && n < PADS));
    assert.equal(extendSequence(seq, rng).length, 4);
    assert.equal(checkInput([0, 1, 2], [0]), "progress");
    assert.equal(checkInput([0, 1, 2], [0, 2]), "wrong");
    assert.equal(checkInput([0, 1, 2], [0, 1, 2]), "round-done");
});

test("oscillate ping-pongs within bounds", () => {
    let s = { value: 79, dir: 1 };
    s = oscillate(s.value, s.dir, 55, 20, 80, 0.1);
    assert.deepEqual(s, { value: 80, dir: -1 });
});

// Every basket position must be hittable at some cannon angle, for both gravity extremes.
function hitsAt(angle, basketX, gravity) {
    let ball = launch(angle);
    for (let i = 0; i < 2000; i++) {
        const next = stepBall(ball, gravity, 1 / 240);
        if (crossesBasketTop(ball, next, basketX)) return true;
        if (isOut(next)) return false;
        ball = next;
    }
    return false;
}

test("cannon: whole basket range is reachable", () => {
    for (const gravity of [760, 900]) {
        for (let x = BASKET.minX; x <= BASKET.maxX; x += 10) {
            let reachable = false;
            for (let a = ANGLE_RANGE.min; a <= ANGLE_RANGE.max && !reachable; a += 0.5) {
                reachable = hitsAt(a, x, gravity);
            }
            assert.ok(reachable, `basket at ${x} unreachable with g=${gravity}`);
        }
    }
});
