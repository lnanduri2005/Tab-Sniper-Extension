// Typing gauntlet: type sentences exactly. Paste is blocked; a typo restarts the sentence.
import { el, flash } from "./ui.js";

export const SENTENCES = [
    "The feed is designed to never end, so I have to be the one who ends it.",
    "Nothing I scroll past right now will matter to me a week from today.",
    "I added this ban on a good day so that a bad day could not undo it.",
    "Boredom is not an emergency, and it does not need to be fixed instantly.",
    "Every minute spent here is a minute borrowed from something I actually care about.",
    "If this site were truly important, I would not need to fight a timer to reach it.",
    "The urge to check will fade in a few minutes whether or not I give in to it.",
    "I am typing this slowly on purpose, and that is exactly the point of the exercise.",
    "Short videos are short so that I will watch a hundred of them without noticing.",
    "Future me asked present me to keep this door locked, and I should respect that.",
    "Being reachable all the time is not the same thing as being present anywhere.",
    "The algorithm knows what keeps me watching, not what makes me feel good afterwards.",
    "I can still remove this ban later, but only after I have thought about it calmly.",
    "Rest means doing nothing on purpose, not filling every gap with endless content.",
    "The people I want to talk to will still be there after I finish what I started.",
    "One more video has never once been just one more video, and I know that by now."
];

export const TARGET_CHARS = { full: 420, mini: 110 };

export function buildPassage(rng, targetChars) {
    const pool = [...SENTENCES];
    const chosen = [];
    let length = 0;
    while (length < targetChars && pool.length) {
        const [sentence] = pool.splice(Math.floor(rng() * pool.length), 1);
        chosen.push(sentence);
        length += sentence.length;
    }
    return chosen;
}

// -> "progress" | "typo" | "done"
export function checkTyping(sentence, typed) {
    if (typed === sentence) return "done";
    return sentence.startsWith(typed) ? "progress" : "typo";
}

export function mount(root, { mini, onComplete, rng = Math.random }) {
    const sentences = buildPassage(rng, mini ? TARGET_CHARS.mini : TARGET_CHARS.full);
    let index = 0;
    let typos = 0;

    const progress = el("div", { class: "challenge-progress" });
    const target = el("div", { class: "typing-target" });
    const input = el("textarea", {
        class: "typing-input",
        rows: "3",
        spellcheck: "false",
        autocomplete: "off",
        placeholder: "Start typing the sentence above..."
    });
    const status = el("div", { class: "challenge-status" });

    for (const evt of ["paste", "drop", "contextmenu"]) {
        input.addEventListener(evt, (e) => {
            e.preventDefault();
            status.textContent = "No pasting. Type it out.";
        });
    }

    function render() {
        const sentence = sentences[index];
        const typed = input.value;
        progress.textContent = `Sentence ${index + 1} of ${sentences.length} · typos: ${typos}`;
        target.replaceChildren(
            el("span", { class: "typed", text: sentence.slice(0, typed.length) }),
            el("span", { class: "untyped", text: sentence.slice(typed.length) })
        );
    }

    input.addEventListener("input", () => {
        const result = checkTyping(sentences[index], input.value);
        if (result === "typo") {
            typos += 1;
            input.value = "";
            status.textContent = "Typo. Sentence restarted.";
            flash(target);
        } else if (result === "done") {
            index += 1;
            input.value = "";
            status.textContent = "";
            if (index >= sentences.length) {
                input.disabled = true;
                onComplete();
                return;
            }
        }
        render();
    });

    root.replaceChildren(
        el("p", { class: "challenge-help", text: "Type each sentence exactly, including punctuation. A typo restarts the sentence." }),
        progress,
        target,
        input,
        status
    );
    render();
    input.focus();
}
