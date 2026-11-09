import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRules, domainRegex, parseBlockPageSearch, blockPageUrl } from "../lib/rules.js";

test("domainRegex matches domain and subdomains only", () => {
    const re = new RegExp(domainRegex("reddit.com"), "i");
    assert.ok(re.test("https://reddit.com"));
    assert.ok(re.test("https://www.reddit.com/r/all?x=1"));
    assert.ok(re.test("http://old.reddit.com:8080/"));
    assert.ok(!re.test("https://notreddit.com/"));
    assert.ok(!re.test("https://reddit.com.evil.io/"));
    assert.ok(!re.test("https://example.com/?q=reddit.com"));
});

test("buildRules redirects main frame with super priority", () => {
    const rules = buildRules(
        [{ domain: "instagram.com", category: "super" }, { domain: "reddit.com", category: "ban" }],
        "chrome-extension://abc/blocked.html"
    );
    assert.equal(rules.length, 2);
    assert.equal(rules[0].id, 1);
    assert.equal(rules[0].priority, 2);
    assert.equal(rules[1].priority, 1);
    assert.deepEqual(rules[0].condition.resourceTypes, ["main_frame"]);
    assert.equal(
        rules[0].action.redirect.regexSubstitution,
        "chrome-extension://abc/blocked.html?d=instagram.com&c=super&u=\\0"
    );
});

test("parseBlockPageSearch keeps original url with its own & and ?", () => {
    const url = blockPageUrl("x", { domain: "reddit.com", category: "ban" }, "https://reddit.com/r/a?b=1&c=2");
    const search = url.slice(url.indexOf("?"));
    assert.deepEqual(parseBlockPageSearch(search), {
        domain: "reddit.com",
        category: "ban",
        url: "https://reddit.com/r/a?b=1&c=2"
    });
});
