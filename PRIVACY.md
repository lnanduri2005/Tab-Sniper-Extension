# Privacy Policy for Tab Sniper

Last updated: November 8, 2026

## The short version

Everything Tab Sniper knows stays on your computer. It has no servers, no accounts, no analytics, no ads and no tracking. It does not use Chrome sync. Nothing you do is ever sent anywhere.

## What Tab Sniper stores, and where

All data is kept in your browser's local extension storage (`chrome.storage.local`) on this device only:

- **Your lists:** banned sites, super-banned sites, and Watched sites with their limits.
- **Your settings:** pause wait and allowance, removal cool-off, Watched cooldown, sounds, and similar preferences.
- **Focus timer:** your saved presets and a history of recent focus sessions (length, start time, whether you finished).
- **Daily counters:** how many times today you tried to open each blocked site, pauses you used, and active Watched cooldowns.
- **Watched-site usage:** for Watched sites only, the minutes you've actively spent on them during the current visit, and the IDs of short videos (for example YouTube Shorts or Instagram Reels) opened in the last few minutes, so the swipe limit can work. Old entries are discarded automatically.
- **30-day stats:** per-day totals of blocked attempts per site, Watched cutoffs, pause minutes and focus minutes. Days older than 30 are deleted automatically.

## What Tab Sniper looks at

- **The address of pages you open,** so it can decide whether a site is blocked. It does not keep a list of the pages you visit.
- **On Watched sites only:** how long the tab is in front and active, and which short-video page you're on, to measure doomscrolling.
- **Whether you're idle:** Chrome's idle signal (no keyboard or mouse use for about 2 minutes), so time away from the computer isn't counted against you.

Tab Sniper never reads what's on a page: not what you type, not passwords, cookies, messages or form fields.

## The mascot on websites

When a Watched site hits a warning or a cutoff, Tab Sniper draws its mascot on top of that page for a few seconds. The drawing is self-contained and does not read anything from the page.

## Backups

Settings → Back up your setup can export your lists and settings to a file, or import one. The file is created on your computer. It goes wherever you choose to put it, and nowhere else.

## Older versions and Chrome sync

Tab Sniper 1.x kept your ban list in Chrome sync. Version 2 moves that data into local storage the first time it runs, then deletes Tab Sniper's copy from Chrome sync. After that, Tab Sniper never reads or writes Chrome sync again.

## Deleting your data

Removing the extension (chrome://extensions → Tab Sniper → Remove) deletes all of its stored data from your browser.

## Permissions and why they're needed

- `storage`: saves your lists, settings and stats locally.
- `tabs`: reads the address of open tabs so blocked sites can be blocked, and opens the dashboard and challenge pages.
- `webNavigation`: notices when you navigate, including in-page navigation like swiping to the next Short.
- `declarativeNetRequest`: redirects blocked sites to the block page before they load.
- `scripting`: draws the mascot on a Watched site at a warning or cutoff.
- `idle`: knows when you've stepped away, so idle time isn't counted.
- `alarms`: ends focus sessions, pauses and cooldowns on time.
- `notifications`: tells you when a focus session ends or a super-ban removal is ready.
- `contextMenus`: adds "Ban this site" to the right-click menu.
- Access to all sites: needed to block any site you choose and to measure Watched sites. It is used only for that.

## Third parties

None. Tab Sniper loads no remote code, fonts or scripts; everything it uses ships inside the extension.

## Changes

If this policy changes, the date at the top will change with it.

## Contact

Questions or concerns: open an issue at https://github.com/lnanduri2005/Tab-Sniper-Extension/issues
