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

// Each pad has its own shape so the game never depends on color alone.
const SHAPES = [
    '<circle cx="12" cy="12" r="7"/>',
    '<path d="M12 4.5 20 19H4z"/>',
    '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>'
];
const NAMES = ["circle", "triangle", "square", "diamond"];

export function mount(root, { mini, onComplete, onEvent = () => {}, rng = Math.random }) {
    const target = mini ? TARGET_LENGTH.mini : TARGET_LENGTH.full;
    let sequence = newSequence(rng, START_LENGTH);
    let inputs = [];
    let accepting = false;

    const progress = el("div", { class: "challenge-progress" });
    const status = el("div", { class: "challenge-status", role: "status", "aria-live": "polite" });
    // Announces each shape as it lights up, so the sequence isn't sight-only.
    const announcer = el("div", { class: "sr-only", "aria-live": "assertive" });
    const pads = Array.from({ length: PADS }, (_, i) =>
        el("button", { class: `memory-pad pad-${i}`, type: "button", "aria-label": `${NAMES[i]} pad`, onclick: () => press(i) })
    );
    pads.forEach((pad, i) => {
        pad.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${SHAPES[i]}</svg>`;
    });
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
            announcer.textContent = NAMES[i];
            await light(i, 450);
            await wait(180);
        }
        status.textContent = "Your turn.";
        announcer.textContent = "";
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
            onEvent("mistake");
            sequence = newSequence(rng, START_LENGTH);
            setTimeout(playRound, 1200);
        } else if (result === "round-done") {
            accepting = false;
            if (sequence.length >= target) {
                status.textContent = "";
                onComplete();
                return;
            }
            onEvent("progress", (sequence.length - START_LENGTH + 1) / (target - START_LENGTH + 1));
            sequence = extendSequence(sequence, rng);
            setTimeout(playRound, 600);
        }
    }

    root.replaceChildren(
        el("p", { class: "challenge-help", text: `Repeat the sequence. It grows each round until length ${target}. One mistake starts over.` }),
        progress,
        board,
        status,
        announcer
    );
    playRound();
}
