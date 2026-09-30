# Hawem design system (v3)

**Design read.** A field instrument for volunteers counting free-roaming cats and
dogs outdoors, in a calm Apple-native language, with a motivating progress layer.
Dials (taste-skill): variance 4, motion 4, density 3. Readable in sunlight beats
decorative. Mode: overhaul of the visuals; content, data and science rules kept.

Sources: `CLAUDE.md` (HIG, SF Pro, zero emoji, effort-over-count gamification),
taste-skill and redesign-skill (anti-slop, states, copy), imagegen-frontend-mobile
(iOS-native premium, navigation, readability, spacing, anti-AI tells),
awesome-design-md `apple` (single action colour, SF type ladder, flat surfaces),
Vercel web-interface-guidelines (dashboard), image-to-code (render, screenshot,
analyse, correct; no image generator is available, so screenshots of the built
screens are the reference images), playwright-cli (the screenshot loop).

## Colour

One action colour. Everything tappable that is a primary action uses it; nothing
decorative does. Species colours are data encoding (map pins, species marks),
never UI chrome.

| Token         | Light              | Dark                     | Use                                 |
| ------------- | ------------------ | ------------------------ | ----------------------------------- |
| canvas        | `#F5F5F7`          | `#0B0B0D`                | screen background                   |
| surface       | `#FFFFFF`          | `#1C1C1E`                | grouped rows, sheets                |
| surfaceRaised | `#FFFFFF`          | `#2C2C2E`                | inputs on surface                   |
| ink           | `#1D1D1F`          | `#F5F5F7`                | primary text                        |
| ink2          | `#56565C`          | `#AEAEB2`                | secondary text (>= 4.5:1 on canvas) |
| ink3          | `#6E6E73`          | `#8E8E93`                | tertiary text, captions             |
| hairline      | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` | separators                          |
| accent        | `#0B6E4F`          | `#3DD68C`                | the action colour                   |
| accentSoft    | `#E4F2EC`          | `#0F2E23`                | selected states, progress tracks    |
| onAccent      | `#FFFFFF`          | `#0B0B0D`                | text on accent                      |
| danger        | `#C62828`          | `#FF6B6B`                | destructive only                    |
| warning       | `#8A5A00`          | `#F5B544`                | sync waiting, low GPS               |
| cat           | `#3F5BD8`          | `#8EA2FF`                | data: cats                          |
| dog           | `#C2410C`          | `#FF9A62`                | data: dogs                          |

Gradients: heroes (Progress, Profile), badge medallions, icon tiles and the
sky photo well use the `hawemGradients` set; body text never sits on the light
end of a gradient. Glass (`Glass`, blur plus translucent wash and a bright edge)
for controls over the map and chips over a gradient hero. Illustrations are
flat vector scenes (`StreetScene`, `AnimalFace`) in the board 4 style, never
emoji. No pure black. Cards and grouped sections carry one faint,
wide shadow in light mode (useCardShadow) instead of borders; dark mode uses
the lighter surface instead. Buttons never have shadows.

## Type (SF Pro via the system font; Android maps to the same ladder)

| Style      | Size / line | Weight |
| ---------- | ----------- | ------ |
| largeTitle | 34 / 41     | 700    |
| title1     | 28 / 34     | 700    |
| title2     | 22 / 28     | 700    |
| title3     | 20 / 25     | 600    |
| headline   | 17 / 22     | 600    |
| body       | 17 / 22     | 400    |
| callout    | 16 / 21     | 400    |
| subhead    | 15 / 20     | 400    |
| footnote   | 13 / 18     | 400    |
| caption    | 12 / 16     | 400    |

Numbers that change or compare use tabular figures. Sentence case everywhere;
no ALL-CAPS labels except the grouped-list section headers iOS itself uses.
Minimum text size 12.

## Space, shape, touch

8-point grid: 4, 8, 12, 16, 20, 24, 32, 48. Screen side margin 20.
Radii: `sm` 12 (inputs, small controls), `lg` 22 (cards, grouped sections),
`xl` 28 (hero and floating cards), `pill` (buttons, chips, tags). Nothing else. Touch targets >= 44 x 44.

## Components

Screen (large title, safe areas, tab-bar clearance) - Section (grouped list,
optional footnote) - Row (icon, title, detail, chevron) - Button (primary pill,
secondary tinted, plain text) - Chip (filter, one selected state) - Stat
(number + label, no card) - ProgressBar / ProgressRing - Badge medallion -
EmptyState (icon, one line, one action) - Toast (XP celebration) - Sheet.

Press feedback: scale to 0.97 with a light haptic. Motion under 250 ms, and none
when the system asks for reduced motion.

## Navigation

Tab bar with icons and labels, translucent: Map, Sightings, record (+), Progress,
Profile. The + opens a sheet with three large choices. Drill-downs push; short
tasks (details, filters) use sheets.

## Gamification (CLAUDE.md section 2)

XP is the server's (`user_stats.xp`), never a device counter. Effort earns more
than counts: distance, complete checklists (zero-animal ones included), photos,
new 1 km cells. Leaderboards rank by kilometres walked and by complete
checklists, never by animals counted. Streaks count weeks with at least one
survey. Weekly quests reset on Monday and are computed from synced data.
Badges are earned from real totals and always show progress towards the next.

## Inspiration pass (image-to-code)

Reference boards in `inspirations for image to code/`. Adopted: greeting header
with a bell, one hero number with weekly bars and two pill actions (Progress),
soft large-radius cards, section titles with a trailing action, activity rows
with a value and a status tag on the right (Sightings), dark selected chips,
a floating card with a category tag and icon detail rows over the map, a
centred avatar with an edit badge and a "Personal info" card (Profile), an
active dot in the tab bar, and a one-idea welcome screen before sign-in.
Second pass (on request): colours sampled from the boards (#144513 deep green
and #B1EC6F lime from board 2, #F1721D orange and sky/grass tones from board
4), gradient heroes (boards 1 and 3), glass controls and cards, gradient icon
tiles (board 3), gradient medallions, and vector illustrations (board 4).
Still not adopted: stock photography and flags (zero-emoji rule).

## Research portal (apps/dashboard)

Same tokens as the app: `packages/design-tokens` is written into CSS variables
at start-up (`src/lib/theme.ts`), so both products share one palette and both
schemes. Following the taste skill, dashboards get a calm, dense product layout
(dials: variance 3, motion 2, density 6): no glass, one brand gradient band for
the headline effort figures, white cards with the one soft shadow, pill buttons,
12 px inputs, 18 px cards. Web interface guidelines applied: URL holds the page
and every filter, Intl formatting, tabular numbers, visible focus, labelled
controls, skeleton loading, honest empty states, reduced motion, dark mode with
`color-scheme`. Data is real and read through RLS as the signed-in researcher;
`VITE_PREVIEW=1` (development only) serves sample data for design review.
