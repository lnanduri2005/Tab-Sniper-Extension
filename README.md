# Tab Sniper

A Chrome extension that stops doomscrolling by making it slower to reach distracting sites than the urge lasts. It's friction, not a prison, and a small window-shaped mascot keeps you company while it judges you.

Chrome Web Store: https://chromewebstore.google.com/detail/tab-sniper/ehdaobjgkeigecnmmdokmbkgkclnlgop

## Features

### Three kinds of block

| | Ban | Watched | Super ban |
|---|---|---|---|
| Blocked | while Tab Sniper is awake or a focus session runs | only when you doomscroll | 24/7, even while it naps |
| Undo | put the mascot to sleep | wait out a cooldown | a random challenge, a cool-off, and a final confirm |

- **Bans:** easy on, easy off.
- **Watched sites:** allowed, but cut off when a quick check turns into a scroll hole:
  - too long in one visit (default 15 min)
  - too long on Shorts, Reels or feeds in a row (8 min)
  - too many short videos in a row (25 in 10 min)

  You get a warning at 80%. After that, a cooldown starts at 30 minutes (adjustable) and doubles with each cutoff that day, up to 4 hours. It can't be paused. Built-in profiles cover YouTube, Instagram, TikTok, X, Reddit and Facebook, and any other site can get a per-visit limit.
- **Super bans:** for the sites that always win.
  - **Pausing:** a 3-minute wait on a page you can't leave, with a daily allowance.
  - **Removing:** a random challenge (typing, cannon game, mental math or memory), then a 12h cool-off, then a final confirm.

### Everything else

- **Focus timer:** forces bans on until it ends. Ending early takes a short challenge.
- **The mascot:** reacts to what you do.
  - It sleeps when Tab Sniper is off and gets smug when it catches you.
  - On the dashboard, tour and challenges it hops around. You can drag it, or throw it (it gets offended).
  - Tap it for a live status report.
  - On Watched sites it peeks up to warn you, and steps in to cut you off.
- **Block page:** shows how many times you've tried today, plus your options. You can choose to close banned tabs instead.
- **Stats:** a 30-day view of your pattern: a heat strip of attempts, top temptations, and this week against last.
- **Settings behind a challenge:** making Tab Sniper easier on you takes a quick challenge, which unlocks Settings for 15 minutes. Making it stricter never does.
- **Backup:** export your lists and settings to a file, and import them on another computer.
- **Fully local:** see [Privacy](#privacy).

## Install

- **From the Chrome Web Store:** use the link above.
- **Unpacked (for development):**
  1. Clone this repo.
  2. Open `chrome://extensions` and turn on Developer mode.
  3. Click **Load unpacked** and pick the repo folder.

On first install, a short tour walks you through the three kinds of block and lets you pick sites to watch.

## Using it

- **Toolbar popup:** wake Tab Sniper up or put it to sleep, start a focus session, and ban, watch or super-ban the site you're on.
- **Dashboard** (the popup's settings icon, or right-click the toolbar icon → Options): manage every list, see your stats, change settings, and back up your setup.
- **Right-click any page** → *Ban this site in Tab Sniper*.

## Privacy

Everything stays on your device. There's no server, no account, no analytics and no Chrome sync, and nothing is ever sent anywhere. Details are in [PRIVACY.md](PRIVACY.md).

## Development

Plain JavaScript ES modules with no build step, on Manifest V3.

```
background.js        service worker: blocking, Watched tracking, timers, storage
lib/                 pure logic (matching, policy, detector, cooldowns, gating, stats, migration, backup)
challenges/          the four challenges
ui/                  design tokens, components, SVG mascot, roaming engine, voice lines
popup.* dashboard.* blocked.* pause.* challenge.* onboarding.*   the pages
lib/sitemascot.js    the self-contained mascot drawn on Watched sites
test/                unit tests (node:test)
```

Run the tests with Node 18 or newer:

```
npm test
```

### Packaging for the store

Zip the extension without the development files. From a clean checkout, `git archive` already leaves out git-ignored files:

```
git archive --format=zip -o tab-sniper.zip HEAD -- . ":(exclude)test" ":(exclude)package.json" ":(exclude).gitignore"
```

## Contributing

Issues and pull requests are welcome.

Original developers: Likitha Nanduri, Parikshith Venkataraghavan and Abhigna Nimmagadda.

## License

MIT. See [LICENSE](LICENSE).
