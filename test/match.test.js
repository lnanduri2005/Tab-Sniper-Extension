import { test } from "node:test";
import assert from "node:assert/strict";
import { extractDomain, normalizeDomain, domainMatches, urlMatchesDomain } from "../lib/match.js";

test("normalizeDomain strips protocol, www, path, case", () => {
    assert.equal(normalizeDomain("https://www.Reddit.com/r/foo?x=1"), "reddit.com");
    assert.equal(normalizeDomain("  youtube.com "), "youtube.com");
    assert.equal(normalizeDomain("m.youtube.com/shorts"), "m.youtube.com");
});

test("normalizeDomain rejects junk", () => {
    assert.equal(normalizeDomain(""), null);
    assert.equal(normalizeDomain("not a domain"), null);
    assert.equal(normalizeDomain("localhost"), null);
});

test("extractDomain only handles http(s)", () => {
    assert.equal(extractDomain("https://www.instagram.com/reels/"), "instagram.com");
    assert.equal(extractDomain("chrome://extensions"), null);
    assert.equal(extractDomain("garbage"), null);
});

test("domainMatches covers subdomains but not lookalikes", () => {
    assert.ok(domainMatches("reddit.com", "reddit.com"));
    assert.ok(domainMatches("old.reddit.com", "reddit.com"));
    assert.ok(!domainMatches("notreddit.com", "reddit.com"));
    assert.ok(!domainMatches("reddit.com.evil.io", "reddit.com"));
    assert.ok(urlMatchesDomain("https://www.reddit.com/r/all", "reddit.com"));
});
