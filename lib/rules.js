// Builds declarativeNetRequest dynamic rules that redirect blocked main-frame loads
// to the block page. The original URL is appended raw as the last param (`&u=`).

export function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function domainRegex(domain) {
    return `^https?://([^/?#]*\\.)?${escapeRegex(domain)}(:[0-9]+)?([/?#].*)?$`;
}

export function blockPageUrl(base, { domain, category }, originalUrl = "") {
    return `${base}?d=${encodeURIComponent(domain)}&c=${category}&u=${originalUrl}`;
}

const PRIORITY = { super: 3, watched: 2, ban: 1 };

export function buildRules(blocks, base) {
    return blocks.map((block, i) => ({
        id: i + 1,
        priority: PRIORITY[block.category] || 1,
        action: {
            type: "redirect",
            redirect: { regexSubstitution: blockPageUrl(base, block, "\\0") }
        },
        condition: {
            regexFilter: domainRegex(block.domain),
            resourceTypes: ["main_frame"]
        }
    }));
}

// Page side: `u` is always last and raw, so it's everything after "&u=" (may contain & itself).
export function splitTrailingUrl(search) {
    const raw = search.startsWith("?") ? search.slice(1) : search;
    const uIndex = raw.indexOf("&u=");
    return {
        params: new URLSearchParams(uIndex === -1 ? raw : raw.slice(0, uIndex)),
        url: uIndex === -1 ? "" : raw.slice(uIndex + 3)
    };
}

export function parseBlockPageSearch(search) {
    const { params, url } = splitTrailingUrl(search);
    return { domain: params.get("d") || "", category: params.get("c") || "", url };
}
