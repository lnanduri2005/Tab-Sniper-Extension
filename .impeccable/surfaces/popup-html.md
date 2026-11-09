---
version: 1
slug: "popup-html"
primary_target: "popup.html"
related_targets: ["blocked.html","dashboard.html","challenge.html","pause.html"]
---

# Tab Sniper extension UI (popup, block page, pause, challenge, dashboard, onboarding, toast)

Mode: Operate (popup, dashboard), with the block page, pause and challenges carrying the personality at the moment of temptation.

## Direction contract

THESIS: The mascot is a browser window, so every surface is the mascot's own body: its frame is the container, its title bar holds the tabs, its face reacts to what you do. Refuses the calm-utility blocker look (soft cards, gradient hero, generic toggle) and any decoration not drawn from the mascot.

OWN-WORLD: Palette only from the mascot: charcoal screen (dark ground), lavender-grey frame (light ground), cream title bar, blush pink, slate blue, white highlights. Everything drawn in the mascot's line art: chunky charcoal outlines, rounded rects, flat fills, hard offset shadow that buttons press into. One rounded sans (M PLUS Rounded 1c), weight carries hierarchy, tabular figures for countdowns. Tiers by weight: Ban outlined, Watched half-filled with an eye, Super ban solid with a padlock and double outline.

STORY: The user sees a character, not a settings panel. Mid-impulse they meet the mascot's face and voice (smug on bans and Watched trips, stern on super bans, encouraging in focus), see their own count, and either leave or pay the stated cost.

FIRST VIEWPORT: Popup = the mascot's window body at 380px: cream title bar with its two dots and browser-style tabs (Home, Focus, Sites); below, the face (asleep when OFF, mischievous when ON) with one contextual speech line, a Wake up / Nap time pill under it, then today's live list and "add this site" control. Block page = one huge mascot centered with a speech bubble above, stat chips beneath, small actions last.

FORM: User-pinned direction from a guided interview after declining two rolled hands (seed key 65b71fda, rerolled once). Signature interaction: the mascot reacts live, with eyes tracking the cursor, expressions per action and state, poke reactions, boredom and sleep. No limbs: expression through face, squash and stretch, tilt, bounce and title-bar dots. Motion respects reduced-motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisions

- Popup nav: title-bar tabs Home / Focus / Sites; stats and history move to the dashboard.
- Dashboard: one large mascot window with tabs Overview / Sites / Focus / Stats / Settings; mascot face peeks from the frame corner.
- Theme: follows system, dark designed first (charcoal ground, cream text); light uses the lavender frame as ground.
- Challenges and pause: mascot is a rival referee beside the task, reacting live; pause wait shows it idling impatiently. Cannon and basket redrawn in the mascot's line art.
- Voice: speech bubble always on block, challenge and pause; one contextual rotating line on popup Home; silent elsewhere. Lines from pools per situation.
- Sound: tiny synthesized blips, off by default, toggle in settings.
- ON/OFF: wake/sleep. OFF = mascot asleep with Zzz in the title bar; pill toggles; locked during focus.
- Onboarding: 4-step skippable mascot tour after install (hello, three tiers, quick-add common Watched sites, done).
- Stats: leads with "your pattern": 30-day attempts heat strip, top temptation sites, week-over-week trend with a mascot comment; focus minutes secondary.
- Theming must stay token-driven so new looks can be layered later.

## Staging

- This phase: design system, SVG mascot with moods and reactions, every surface restyled, toast restyled with the mascot face, 30-day stats data.
- Next: mascot roaming on full-tab pages.
- After: mascot visiting real Watched sites in place of the toast.
