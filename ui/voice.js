// What the mascot says. Smug when it catches you, stern on super bans,
// encouraging during focus. Lines are picked at random without immediate repeats.

export const LINES = {
    "block.ban": [
        "Attempt #{n}. Really?",
        "Nope. Not while I'm awake.",
        "{site}? Bold. Denied.",
        "You opened a whole tab just to see me. Cute.",
        "I'm on duty. {site} is not.",
        "Caught you. Again."
    ],
    "block.super": [
        "No.",
        "{site} is locked. You locked it.",
        "Not today. Not any day.",
        "Attempt #{n}. Same answer.",
        "This one's in the vault. For a reason.",
        "Past you asked me to say no. So: no."
    ],
    "block.watched": [
        "{reason}. That's plenty.",
        "I counted. You don't want to know.",
        "Cooldown. Go do literally anything else.",
        "That was a lot of scrolling. Break time.",
        "{site} needs a rest. So do your thumbs."
    ],
    "block.focus": [
        "Focus mode. {left} to go. You've got this.",
        "Stay with it. {site} will survive without you.",
        "Halfway there is still there. Keep going.",
        "Not now. Finish strong."
    ],
    "pause.wait": [
        "I'll wait. I'm very patient.",
        "Still sure about this?",
        "Tap. Tap. Tap.",
        "You could just... not.",
        "Every second counts. I'm counting them."
    ],
    "pause.reset": [
        "You left. We start over.",
        "Tab switching resets the clock. Rules are rules.",
        "Nice try. From the top."
    ],
    "pause.done": ["Fine. {minutes} minutes. I'm watching the clock."],
    "challenge.start": ["Go on then.", "Let's see you try.", "This is going to take a while.", "I believe in you. Unfortunately."],
    "challenge.mistake": ["Oops.", "Hehe.", "Again!", "So close. Not really.", "Butterfingers."],
    "challenge.close": ["Wait... no...", "Getting nervous here.", "You wouldn't.", "Okay, slow down."],
    "challenge.done.removal": ["Fine. {hours}h cool-off starts now.", "...fine. The clock starts. I'll be watching."],
    "challenge.done.endEarly": ["Fine. Session over. I'm not mad. I'm just counting."],
    "home.off": ["Zzz... wake me when you need me.", "Napping. Super bans stay awake though.", "Off duty. Mostly."],
    "home.on": ["Awake. Try me.", "On duty.", "{n} tries today. I'm counting.", "{site} again? I noticed."],
    "home.calm": ["Awake. Nobody's tried anything yet.", "Quiet day. Suspicious.", "On duty. All clear."],
    "home.focus": ["{left} left. You're doing great.", "Locked in. Keep going.", "Focus time. I've got the door."],
    "home.empty": ["Give me something to guard.", "No sites yet. Ban one from the Sites tab."],
    "dash.hello": ["Welcome back. Here's the damage.", "Let's see how you did.", "Command center. Mine, technically."],
    "stats.none": ["Nothing in 30 days. Either you're a monk or I'm new here."],
    "stats.first": ["First week on the books. I'm watching the trend."],
    "stats.down": ["Down {pct}% from last week. Suspicious.", "{pct}% fewer tries than last week. Who are you?"],
    "stats.up": ["Up {pct}% from last week. We need to talk.", "More tries than last week. I noticed."],
    "stats.flat": ["About the same as last week. Steady. Too steady."]
};

let lastPicked = {};
try {
    lastPicked = JSON.parse(sessionStorage.getItem("ts-voice") || "{}");
} catch {
    lastPicked = {};
}

export function fill(template, vars = {}) {
    return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? "").toString());
}

export function say(situation, vars = {}, rng = Math.random) {
    const pool = LINES[situation] || [""];
    // Only lines whose variables are all available.
    const usable = pool
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => [...line.matchAll(/\{(\w+)\}/g)].every(([, k]) => vars[k] !== undefined && vars[k] !== ""));
    const options = usable.length ? usable : pool.map((line, i) => ({ line, i }));
    let choices = options.filter(({ i }) => i !== lastPicked[situation]);
    if (!choices.length) choices = options;
    const { line, i } = choices[Math.floor(rng() * choices.length)];
    lastPicked[situation] = i;
    try {
        sessionStorage.setItem("ts-voice", JSON.stringify(lastPicked));
    } catch {
        /* storage blocked: repeats are fine */
    }
    return fill(line, vars);
}
