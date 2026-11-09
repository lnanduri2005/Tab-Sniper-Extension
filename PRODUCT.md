# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences weighted equally:

- **Daily users** (the authors and their friends): people who know they doomscroll and installed Tab Sniper to stop. They open the popup several times a day, hit the block page often, and occasionally grind through a challenge. They need speed and zero friction in the parts that should be easy (adding a ban, starting focus).
- **Chrome Web Store installers**: strangers who must understand the three site categories and what each costs to undo without help.

The user is usually mid-impulse when Tab Sniper speaks to them: they just tried to open a blocked site, or they've been swiping Shorts too long.

## Product Purpose

A Chrome (MV3) extension that stops doomscrolling by making bypassing slower than the impulse lasts. Success: the user reaches for a distracting site, meets friction, and the urge passes before the friction does.

## Positioning

Friction, not prison. Three tiers with different undo costs:

- **Ban**: blocked while Tab Sniper is ON or a focus session runs; free to add and remove.
- **Watched**: allowed, but cut off when doomscrolling is detected (per-visit time, short-form streak, swipe count), followed by escalating, unpausable cooldowns.
- **Super ban**: blocked 24/7. Pausing costs a 3-minute wait on a page you can't leave (daily cap). Removal costs a random challenge (typing, cannon game, mental math, memory) plus a 12h cool-off and a final confirm.

Settings that weaken super bans only take effect after the cool-off.

## Operating Context

- Surfaces: toolbar popup (~380px wide, closes on blur), full-tab dashboard (options page), block page (replaces the blocked site), pause countdown page, challenge page, in-page warning toast on Watched sites.
- The block page and toast appear at the moment of temptation; the popup and dashboard are calm management moments.
- Data lives in chrome.storage; no accounts, no servers.

## Capabilities and Constraints

- Vanilla JS ES modules, no build step. Unit tests via `node --test`.
- Extension pages may load scripts only from the extension package (MV3 CSP). Fonts must be self-hosted.
- Popup width is fixed and small; challenge and pause flows must run in full tabs.
- Honest limits: cannot stop disabling at chrome://extensions, incognito, or uninstall.

## Brand Commitments

- Name: **Tab Sniper**. The sniper/target theme may inform the design.
- Mascot: the kawaii browser-window character (window frame with title-bar dots, face with eyes, blush, "w" mouth). Rebuilt as SVG with moods; shape and face must stay recognizable. Current PNGs: `icon_mischiveous.png`, `icon_sleep.png`, `icon_idle.png`.
- Voice shifts by situation: smug and teasing when it catches you on a ban or Watched trip; encouraging during focus sessions; stern and unimpressed on super bans.
- Not binding: the current purple palette, fonts, layout, and the cannon/basket PNGs.

## Evidence on Hand

- Authors: Likitha Nanduri, Abhigna Nimmagadda, Parikshith Venkataraghavan.
- Chrome Web Store listing: https://chromewebstore.google.com/detail/tab-sniper/ehdaobjgkeigecnmmdokmbkgkclnlgop
- No user counts, ratings, testimonials, or press. Do not invent any.

## Product Principles

1. Easy things stay easy: adding a ban, starting focus, checking status take one or two actions.
2. Hard things are honestly hard: undo costs are stated up front, never hidden.
3. Speak at the moment of temptation: the block page is the most-seen screen and carries the personality.
4. Awareness over punishment: show attempts, streaks, and trips so the user sees their own pattern.

## Accessibility & Inclusion

WCAG AA contrast, keyboard operability, and reduced-motion support on every surface, including challenges (no challenge may depend on color alone).
