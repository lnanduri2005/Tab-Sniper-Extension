// Tiny synthesized mascot blips. Off unless settings.soundOn is true.

let enabled = false;
let ctx = null;

export function setSoundEnabled(on) {
    enabled = !!on;
}

export async function loadSoundSetting() {
    try {
        const { settings } = await chrome.storage.sync.get("settings");
        enabled = !!settings?.soundOn;
    } catch {
        enabled = false;
    }
    return enabled;
}

const PATTERNS = {
    poke: [[880, 0.06], [1320, 0.05]],
    happy: [[660, 0.07], [880, 0.07], [1100, 0.09]],
    deny: [[220, 0.12], [180, 0.14]],
    tick: [[1200, 0.03]],
    oops: [[520, 0.06], [390, 0.09]],
    win: [[523, 0.08], [659, 0.08], [784, 0.08], [1046, 0.16]]
};

export function play(kind) {
    if (!enabled || !PATTERNS[kind]) return;
    try {
        ctx ||= new AudioContext();
        let t = ctx.currentTime;
        for (const [freq, dur] of PATTERNS[kind]) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + dur + 0.02);
            t += dur * 0.9;
        }
    } catch {
        /* audio unavailable */
    }
}
