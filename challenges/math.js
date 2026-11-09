// Mental math: solve N problems. A wrong answer adds 3 more.
import { el, flash } from "./ui.js";
import { randInt } from "../lib/rng.js";

export const PROBLEM_COUNT = { full: 20, mini: 5 };
export const PENALTY = 3;

export function makeProblem(rng) {
    const form = randInt(rng, 0, 3);
    if (form === 0) {
        const a = randInt(rng, 12, 49), b = randInt(rng, 3, 9), c = randInt(rng, 10, 99);
        return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
    }
    if (form === 1) {
        const a = randInt(rng, 12, 49), b = randInt(rng, 3, 9), c = randInt(rng, 10, 99);
        return { text: `${a} × ${b} − ${c}`, answer: a * b - c };
    }
    if (form === 2) {
        const a = randInt(rng, 11, 39), b = randInt(rng, 11, 39), c = randInt(rng, 3, 7);
        return { text: `(${a} + ${b}) × ${c}`, answer: (a + b) * c };
    }
    const b = randInt(rng, 3, 9), q = randInt(rng, 12, 40), c = randInt(rng, 10, 60);
    return { text: `${b * q} ÷ ${b} + ${c}`, answer: q + c };
}

export function mount(root, { mini, onComplete, rng = Math.random }) {
    let remaining = mini ? PROBLEM_COUNT.mini : PROBLEM_COUNT.full;
    let solved = 0;
    let problem = makeProblem(rng);

    const progress = el("div", { class: "challenge-progress" });
    const question = el("div", { class: "math-question" });
    const input = el("input", { class: "math-input", type: "text", inputmode: "numeric", autocomplete: "off" });
    const status = el("div", { class: "challenge-status" });
    const form = el("form", { class: "math-form" }, [input, el("button", { type: "submit", class: "btn", text: "Submit" })]);

    function render() {
        progress.textContent = `Solved ${solved} · ${remaining} to go`;
        question.textContent = `${problem.text} = ?`;
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const value = input.value.trim();
        if (!/^-?\d+$/.test(value)) return;
        if (Number(value) === problem.answer) {
            solved += 1;
            remaining -= 1;
            status.textContent = "";
        } else {
            remaining += PENALTY;
            status.textContent = `Wrong, it was ${problem.answer}. +${PENALTY} problems.`;
            flash(question);
        }
        input.value = "";
        if (remaining <= 0) {
            input.disabled = true;
            onComplete();
            return;
        }
        problem = makeProblem(rng);
        render();
    });

    root.replaceChildren(
        el("p", { class: "challenge-help", text: "No calculator. Each wrong answer adds 3 more problems." }),
        progress,
        question,
        form,
        status
    );
    render();
    input.focus();
}
