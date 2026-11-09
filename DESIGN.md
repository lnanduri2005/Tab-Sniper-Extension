---
name: Tab Sniper
description: A doomscroll blocker drawn as its own mascot, a kawaii browser window that guards your tabs.
colors:
  mascot-ink: "#221f29"
  mascot-screen: "#3a3743"
  mascot-frame: "#c9c3d6"
  mascot-frame-deep: "#a59eb6"
  mascot-cream: "#f2e8ca"
  mascot-cream-deep: "#e2d4ab"
  mascot-blush: "#ee93ab"
  mascot-blush-deep: "#d96784"
  mascot-slate: "#5c6688"
  mascot-slate-light: "#9aa4c8"
  mascot-white: "#fdfcff"
  dark-surface: "#474452"
  dark-surface-2: "#53505f"
  dark-text-muted: "#cdc7da"
  dark-outline: "#17151c"
  light-bg: "#e6e2ee"
  light-surface-2: "#f1eef6"
  light-text-muted: "#565168"
  light-danger: "#a83a5a"
  light-note: "#a3375a"
typography:
  display:
    fontFamily: "M PLUS Rounded 1c, ui-rounded, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "M PLUS Rounded 1c, ui-rounded, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "M PLUS Rounded 1c, ui-rounded, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.15
  voice:
    fontFamily: "M PLUS Rounded 1c, ui-rounded, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.5
  body:
    fontFamily: "M PLUS Rounded 1c, ui-rounded, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "M PLUS Rounded 1c, ui-rounded, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.5
  chip:
    fontFamily: "M PLUS Rounded 1c, ui-rounded, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1
rounded:
  sm: "10px"
  md: "14px"
  lg: "20px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.mascot-blush}"
    textColor: "{colors.mascot-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "9px 20px"
  button-cream:
    backgroundColor: "{colors.mascot-cream}"
    textColor: "{colors.mascot-ink}"
    rounded: "{rounded.pill}"
    padding: "9px 20px"
  button-slate:
    backgroundColor: "{colors.mascot-slate-light}"
    textColor: "{colors.mascot-ink}"
    rounded: "{rounded.pill}"
    padding: "9px 20px"
  button-ghost-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.mascot-cream}"
    rounded: "{rounded.pill}"
    padding: "9px 20px"
  button-small:
    rounded: "{rounded.pill}"
    padding: "5px 13px"
  field:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.mascot-cream}"
    rounded: "{rounded.pill}"
    padding: "9px 16px"
  titlebar-tab:
    backgroundColor: "{colors.mascot-cream-deep}"
    textColor: "{colors.mascot-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "5px 13px 6px"
  titlebar-tab-selected:
    backgroundColor: "{colors.mascot-frame}"
    textColor: "{colors.mascot-ink}"
    padding: "5px 13px 8px"
  tier-ban:
    textColor: "{colors.mascot-cream}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  tier-watched:
    backgroundColor: "{colors.mascot-slate-light}"
    textColor: "{colors.mascot-ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  tier-super:
    backgroundColor: "{colors.mascot-ink}"
    textColor: "{colors.mascot-cream}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  tier-icon-only:
    size: "30px"
    rounded: "{rounded.pill}"
    padding: "6px"
  row:
    backgroundColor: "{colors.dark-surface}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.dark-surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  speech-bubble:
    backgroundColor: "{colors.mascot-white}"
    textColor: "{colors.mascot-ink}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  icon-button:
    size: "30px"
    rounded: "{rounded.pill}"
---

# Design System: Tab Sniper

## Overview

**Creative North Star: "The Mascot's Own Body"**

Tab Sniper's mascot is a browser window with a face, so every surface is that window: its lavender frame is the container, its cream title bar holds the navigation as browser-style tabs, its charcoal screen is the ground, and its face reacts to what you do. Nothing is decoration borrowed from elsewhere. Color, line weight, corner radius and the hard sticker shadow are all lifted from the mascot drawing, which makes the whole extension read as a character rather than a settings panel.

The world is drawn, not rendered: chunky charcoal outlines (2.5px, 3.5px on the outer frame), flat fills, rounded rectangles and pills, and a single hard offset shadow that buttons physically press into. One rounded sans carries everything, with weight doing the hierarchy work. Density is calm and roomy in the popup and dashboard, loud and singular on the block, pause and challenge pages where the mascot fills the viewport at the moment of temptation.

Dark is designed first: the mascot's screen is the ground and cream is the text. Light swaps the ground to the frame's lavender family and the text to ink, while the mascot itself never changes color. Every theme value is a custom property in `ui/tokens.css`, so new looks layer on as additional `[data-theme]` blocks.

**Key Characteristics:**
- Every color comes from the mascot drawing; no outside hues.
- Surfaces are the mascot window: frame, title bar with two dots, browser-style tabs, inner screen.
- Heavier visual weight means harder to undo (ban outlined, Watched filled, Super ban solid ink with a double ring).
- Chunky charcoal line art, flat fills, rounded corners, one hard sticker shadow.
- The mascot has no limbs; it emotes through its face, squash and stretch, tilt, bounce and its title-bar dots.
- Dark first, follows the system theme, token-driven throughout.

## Colors

A small, fixed mascot palette (charcoal, lavender-grey, cream, blush, slate, white) mapped onto theme roles; the palette never changes, only which mascot color plays which role.

### Primary
- **Mascot Blush** (mascot-blush): the cheeks. Primary buttons, focus ring and inline notes in dark, the "now" step dot, heat-strip and bar fills. In dark it is the one warm voice on a charcoal ground.

### Secondary
- **Slate Blue** (mascot-slate): the second title-bar dot. Focus ring and secondary text color in light, the Zzz when asleep, completed step dots.
- **Slate Light** (mascot-slate-light): Watched tier fill, sweat drop, slate buttons, secondary role in dark.

### Tertiary
- **Title-Bar Cream** (mascot-cream): the title bar of every window, dark-theme text, the "off" pill state, cream buttons, the inner ring of the Super ban chip.
- **Deep Cream** (mascot-cream-deep): unselected title-bar tabs and title-button hover.
- **Deep Blush** (mascot-blush-deep): danger in dark, with ink text (about 4.8:1). Light uses **Rose Danger** (light-danger) and **Berry Note** (light-note) for legible danger and inline notes on pale ground.

### Neutral
- **Mascot Ink** (mascot-ink): every outline in light, title-bar text, Super ban fill, bubble text.
- **Deep Outline** (dark-outline): outlines in dark, one step darker than ink so line art still reads on the charcoal screen.
- **Screen Charcoal** (mascot-screen): the face screen; the page ground in dark.
- **Raised Charcoal** (dark-surface) and **Higher Charcoal** (dark-surface-2): rows, cards, fields, state chips in dark.
- **Frame Lavender** (mascot-frame): the window frame in both themes and the selected tab, which visually joins the frame.
- **Deep Frame** (mascot-frame-deep): scrollbar thumb.
- **Lavender Ground** (light-bg), **Mascot White** (mascot-white) and **Pale Lavender** (light-surface-2): ground, surfaces and secondary surfaces in light. White is also the speech bubble in both themes.
- **Muted Lavender** (dark-text-muted) / **Muted Plum** (light-text-muted): secondary text.

### Named Rules
**The Mascot Palette Rule.** Every color on every surface comes from the mascot drawing. A new hue needs a new mascot part first.

**The Fixed Mascot Rule.** The mascot's own colors (frame, cream title bar, screen, blush, slate, ink) do not change with theme. Only the role tokens (`--bg`, `--surface`, `--text`, `--outline`, `--accent`, `--focus`, `--note`, `--danger`) swap.

**The Token Theme Rule.** Theme values live only in `ui/tokens.css`. Light is applied both by `prefers-color-scheme: light` and by `[data-theme="light"]`, and `[data-theme="dark"]` overrides the system. A new look is a new `[data-theme]` block, never per-component overrides.

## Typography

**Display Font:** M PLUS Rounded 1c (with ui-rounded, system-ui, sans-serif), self-hosted at 400, 700 and 800.
**Body Font:** the same family.

**Character:** One soft, rounded sans that matches the mascot's rounded line art. Weight, not a second face, separates voice from information.

### Hierarchy
- **Display** (800, 56px, line-height 1, -0.02em): countdown clocks in the popup and dashboard focus box. Full-tab pause clock scales `clamp(56px, 12vw, 96px)`.
- **Headline** (800, 34px, 1.15): domain titles on block pages, panel titles, challenge and onboarding headings.
- **Voice** (800, 24px): the big speech bubble on block pages and the onboarding hello. The popup voice line is 800 at 18px.
- **Title** (800, 18px, 1.15): column heads, tier-card heads, the wake pill.
- **Body** (400, 15px, 1.5): default text; ledes cap at 56-60ch, details at 46ch, bubbles at 22-34ch.
- **Label** (700-800, 13px): row meta, tabs, small buttons, section titles, settings descriptions.
- **Chip** (800, 12px, line-height 1): tier chips and compact limit labels.

### Named Rules
**The Weight Hierarchy Rule.** Hierarchy comes from weight (400 / 700 / 800) and the fixed scale (12, 13, 15, 18, 24, 34, 56). No second family, no uppercase tracking.

**The Tabular Figures Rule.** The body sets `font-variant-numeric: tabular-nums` so countdowns and counts never jitter.

**The Attached Units Rule.** A number stays attached to its unit. Voice lines replace the space after a number with a no-break space ("10 min", "25 Shorts", "48%"), and new copy follows the same rule.

## Layout

Each surface is a mascot window: frame padding 7px, a title bar 38-52px tall depending on scale, then the inner screen. Spacing runs on a 4px-based scale (4, 8, 12, 16, 24, 32, 48).

- **Popup:** fixed 380px wide, 520-600px tall. The window fills the popup with no outer border. A face stage (252px face on Home, 92px compact on Focus and Sites) sits above a scrolling panel.
- **Block / pause pages:** one centered column, the mascot at `min(300px, 70vw)`, the bubble above, fact chips below, small actions last.
- **Challenge page:** a two-column grid (task up to 620px, 240px referee mascot). Below 820px it stacks with the referee in a row above the task.
- **Dashboard:** one large window capped at 1120px with the corner mascot tucked behind its bottom-right edge, rotated -12deg, with its bubble layered over the frame. Panels collapse to one column below 960px; tabs compress below 560px.
- **Onboarding:** an 860px window with step dots in the title bar; card grids stack below 720px.

## Elevation & Depth

Depth is drawn, not lit. Surfaces are flat fills separated by outlines. The only shadows are hard, zero-blur offsets and solid rings from the sticker line-art world. There is no ambient or blurred shadow anywhere.

### Shadow Vocabulary
- **Press shadow** (`box-shadow: 0 var(--press) 0 var(--outline)`, press 4px, 3px on small buttons): sits under sticker buttons and memory pads. On press the element moves down by the press distance and the shadow goes to 0.
- **Super ring** (`box-shadow: 0 0 0 2px var(--m-cream), 0 0 0 4px var(--m-ink)`; 3px/6px on the onboarding Super card): the double outline that marks the heaviest tier.
- **Today ring** (`box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--text)`; cream on dark, ink on light): marks today's cell in the heat strip.

### Named Rules
**The Sticker Press Rule.** The hard offset press shadow belongs to the mascot's sticker line art and the user chose it. It is reserved for pressable things (buttons, memory pads, the toast sticker). Cards, rows and fields stay flat.

## Shapes

Rounded rectangles and pills, all outlined. Small radius (10px) for tabs, medium (14px) for rows, cards, the inner screen and number fields, large (20px) for the outer window and speech bubbles, pill (999px) for buttons, text fields, chips and tracks. Circles for the title-bar dots and icon buttons. Line weights are 2.5px for components and 3.5px for the outer window frame. Icons are 24px line drawings at 2.2 stroke with round caps and joins, inline SVG in `currentColor`.

## Components

### Buttons
Tactile stickers that sink into their shadow.
- **Shape:** pill (999px), 2.5px outline, 800 weight.
- **Primary:** blush fill, ink text. Variants: cream, slate-light, ghost (surface fill, theme text), danger.
- **Hover / Focus / Active:** hover brightens slightly (1.05). Focus is a 3px ring in the focus token, offset 3px. Active moves the button down 4px into its shadow in 0.12s ease-out. Disabled is 50% opacity.
- **Wake / Nap pill:** the ON/OFF control is a pill button with `aria-pressed`. Pressed is blush ("Nap time"), unpressed is cream ("Wake up").

### Chips
- **Tier chips:** weight shows undo cost. **Ban** is outlined and transparent. **Watched** is filled slate-light with ink text and an eye icon. **Super ban** is solid ink with cream text, a padlock and the double Super ring. Icon-only tier chips are 30px circles with the same fills.
- **Fact and filter chips:** pill, 13px 800, surface or ground fill. A selected filter turns cream.

### Cards / Containers
- **Window:** the frame-lavender container with a 3.5px outline, 20px corners, cream title bar with pink and slate dots, and an inner screen with a 2.5px outline and 14px corners.
- **Rows and cards:** surface fill, 2.5px outline, 14px corners, 10-16px padding, flat.
- **Tier cards (onboarding):** use the same weight ladder as the tier chips.

### Inputs / Fields
- **Style:** pill text field with surface fill and a 2.5px outline. Selects and number inputs use 14px corners.
- **Focus:** the global 3px focus-token ring.
- **On/off settings:** no generic switch. Use the pill toggle (a `.btn` with `aria-pressed`, blush when on, cream when off, labelled with its state, e.g. "Blips on" / "Quiet").

### Navigation
- **Title-bar tabs:** browser-style tabs that hang from the title bar, deep cream with ink text and an outline on three sides. The selected tab takes the frame color, grows 2px taller and merges into the frame. Used for popup Home / Focus / Sites and dashboard Overview / Sites / Focus / Stats / Settings.

### Speech Bubble
White with ink text, 2.5px outline, 20px corners and a rotated-square tail (bottom, or `.side` for the left). Text is 700, balanced, 34ch max. The big variant on block pages is 24px 800.

### Mascot
An inline SVG drawn in mascot colors only, with moods (mischievous, asleep, smug, stern, encouraging and more). The eyes track the cursor and blink, the body breathes, and one-shot reactions are bounce, squash, hop, tilt-shake, nod, tilt and title-bar dot flicker. When asleep, a Zzz shows in the title bar and the dots dim. Every animation stops under reduced motion.

### Roaming Mascot
On full-tab pages (dashboard, tour, challenges) the mascot is a single roamer (`ui/roam.js`, geometry in `ui/roam-math.js`). Block and pause pages keep the big centered mascot instead.
- **Perches:** each page declares a short list. `sit` rests the mascot on an element's top edge (front layer, used when it's engaged). `peek` tucks about half of it behind a window edge (back layer, used for idle wandering), so windows need `position: relative; z-index: 2`. Perches that would land off-screen are skipped.
- **Hops:** about 0.6s: crouch, arc, stretch, squash on landing. Long trips split into 2 or 3 bounces. Under reduced motion it fades to the new spot instead.
- **Bubble:** rides with the mascot, opens on the side with room (a perch may prefer a side), points its tail at the mascot, and fades after about 5s.
- **Interaction:** tap = one live status fact while awake (`ui/status.js`), a sleepy mumble while asleep, annoyed after 4 rapid taps. Drag snaps to the nearest perch. A release faster than 1600px/s is a throw: it flies off and returns at the farthest perch, offended. The `mascotStill` setting stops idle wandering only.

### On-Site Mascot
Injected on Watched sites (`lib/sitemascot.js`) as a self-contained shadow-DOM drawing. It can't read the page's tokens, so it carries a fixed copy of the mascot palette and faces. Keep its hex values in sync with `ui/tokens.css`.
- **Peek** (80% warning): rises from the bottom-right edge with its face showing over the edge, speaks, and ducks away after about 8s. Tap asks the extension for a status fact; throw dismisses it; a slow drop slides it back.
- **Cutoff** (trip): hops to the middle of the page at 1.5x, says "That's enough.", and the screen fills with the screen charcoal before the block page loads (about 1.6s).

### Named Rules
**The Heavier Is Harder Rule.** Visual weight tracks undo cost: outlined, then filled, then solid ink with a double ring. Never style a lighter tier heavier than a stricter one.

**The No Limbs Rule.** The mascot never grows arms, legs or hands. It shows emotion only through its face, squash and stretch, tilt, bounce and its title-bar dots.

**The Perch Rule.** The roaming mascot sits on or peeks from behind elements; it never covers the content you're reading or the task you're doing.

**The Character Bounce Rule.** Overshoot easing (`--ease-spring`) and bounce keyframes belong to the mascot's character reactions. Interface state changes use `--ease-out`.

## Do's and Don'ts

### Do:
- **Do** take every color from the mascot palette through the role tokens in `ui/tokens.css`.
- **Do** build each new surface as a mascot window: frame, cream title bar with pink and slate dots, title-bar tabs, inner screen.
- **Do** design dark first, then check light. Both must meet WCAG AA, and challenges must never depend on color alone.
- **Do** give pressable elements the 4px hard press shadow and sink them into it on press.
- **Do** show tier by weight: ban outlined, Watched filled slate-light, Super ban solid ink with a double ring and a padlock.
- **Do** keep numbers attached to their units with a no-break space, and set figures in tabular numerals.
- **Do** respect reduced motion on every animation, including mascot reactions.

### Don't:
- **Don't** add hues, gradients or decoration that aren't part of the mascot drawing.
- **Don't** use blurred or ambient shadows. Depth is outlines, flat fills and the hard sticker offset.
- **Don't** give the mascot limbs.
- **Don't** use bounce or overshoot easing for interface chrome. It belongs to the mascot's reactions.
- **Don't** hardcode theme colors in surface CSS. Add a token or a `[data-theme]` block.
- **Don't** fall back to a calm-utility blocker look: soft shadowed cards, a gradient hero or a generic toggle in place of the wake/nap pill.
