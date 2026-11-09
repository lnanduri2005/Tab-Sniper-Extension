// Memory sequence: repeat a growing sequence of pads. A mistake restarts from the start length.
import { el } from "./ui.js";

export const PADS = 4;
export const START_LENGTH = 3;
export const TARGET_LENGTH = { full: 12, mini: 6 };

export function newSequence(rng, length) {
    return Array.from({ length }, () => Math.floor(rng() * PADS));
}

export function extendSequence(sequence, rng) {
    return [...sequence, Math.floor(rng() * PADS)];
}

// -> "progress" | "wrong" | "round-done"
export function checkInput(sequence, inputs) {
    const i = inputs.length - 1;
    if (inputs[i] !== sequence[i]) return "wrong";
    return inputs.length === sequence.length ? "round-done" : "progress";
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function mount(root, { mini, onComplete, rng = Math.random }) {
    const target = mini ? TARGET_LENGTH.mini : TARGET_LENGTH.full;
    let sequence = newSequence(rng, START_LENGTH);
    let inputs = [];
    let accepting = false;

    const progress = el("div", { class: "challenge-progress" });
    const status = el("div", { class: "challenge-status" });
    const pads = Array.from({ length: PADS }, (_, i) =>
        el("button", { class: `memory-pad pad-${i}`, type: "button", "aria-label": `Pad ${i + 1}`, onclick: () => press(i) })
    );
    const board = el("div", { class: "memory-board" }, pads);

    async function light(i, ms) {
        pads[i].classList.add("lit");
        await wait(ms);
        pads[i].classList.remove("lit");
    }

    async function playRound() {
        accepting = false;
        inputs = [];
        progress.textContent = `Length ${sequence.length} of ${target}`;
        status.textContent = "Watch...";
        await wait(700);
        for (const i of sequence) {
            await light(i, 450);
            await wait(180);
        }
        status.textContent = "Your turn.";
        accepting = true;
    }

    function press(i) {
        if (!accepting) return;
        light(i, 180);
        inputs.push(i);
        const result = checkInput(sequence, inputs);
        if (result === "wrong") {
            accepting = false;
            status.textContent = `Wrong pad. Back to length ${START_LENGTH}.`;
            sequence = newSequence(rng, START_LENGTH);
            setTimeout(playRound, 1200);
        } else if (result === "round-done") {
            accepting = false;
            if (sequence.length >= target) {
                status.textContent = "";
                onComplete();
                return;
            }
            sequence = extendSequence(sequence, rng);
            setTimeout(playRound, 600);
        }
    }

    root.replaceChildren(
        el("p", { class: "challenge-help", text: `Repeat the sequence. It grows each round until length ${target}. One mistake starts over.` }),
        progress,
        board,
        status
    );
    playRound();
}
