// Domain helpers. Entries in every list are bare hostnames like "reddit.com".

export function extractDomain(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        return parsed.hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
        return null;
    }
}

// Turn user input ("https://www.Reddit.com/r/foo", "reddit.com") into "reddit.com".
// Returns null when the input can't be a domain.
export function normalizeDomain(input) {
    const trimmed = String(input || "").trim();
    if (!trimmed || /\s/.test(trimmed)) return null;
    const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
    let hostname;
    try {
        hostname = new URL(hasProtocol ? trimmed : `https://${trimmed}`).hostname;
    } catch {
        return null;
    }
    hostname = hostname.replace(/^www\./i, "").toLowerCase();
    if (!hostname.includes(".") || hostname.startsWith(".") || hostname.endsWith(".")) return null;
    return hostname;
}

export function domainMatches(hostname, domain) {
    if (!hostname || !domain) return false;
    return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function urlMatchesDomain(url, domain) {
    return domainMatches(extractDomain(url), domain);
}
