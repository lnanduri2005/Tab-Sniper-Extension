// Local-calendar day key, e.g. "2026-11-08". Daily counters reset when this changes.
export function dayKey(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
}

// Increment a per-day, per-key counter object of shape { day, byKey: {} }.
export function bumpDaily(counter, day, key, amount = 1) {
    const byKey = counter?.day === day ? { ...counter.byKey } : {};
    byKey[key] = (byKey[key] || 0) + amount;
    return { day, byKey };
}

export function readDaily(counter, day, key) {
    return counter?.day === day ? counter.byKey?.[key] || 0 : 0;
}
