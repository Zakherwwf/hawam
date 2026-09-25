# Design System: Apple Human Interface Guidelines (Liquid Glass)

## 1. Design Language & Principles
Hawem adopts the **Apple Human Interface Guidelines (HIG)** and the **iOS Liquid Glass** material language across both iOS and Android.

- **Clean & Quiet**: Information density is high but visual noise is low. The interface steps back so the map, the animals, and the scientific metrics stand out.
- **Zero Emojis**: Strictly prohibited. All iconography uses Apple SF Symbols or custom vector SVGs with crisp 1.5–2pt strokes.
- **Calibrated Palette**: Deep slate neutrals (`#0F172A`, `#1E293B`) paired with a singular energetic teal tint (`#0891B2` / `#06B6D4`), plus species-specific secondary accents:
  - **Cat**: Cyan / Teal (`#0891B2` / `#E0F2FE`)
  - **Dog**: Warm Amber (`#F97316` / `#FFEDD5`)
  - Color is never the sole carrier of meaning; accompanied by text labels and distinct glyphs.
- **Liquid Glass Materials**: Translucent blurs (`BlurView` with `intensity={50}` and `tint="prominent"` or `"systemUltraThinMaterial"`) on iOS, with graceful fallback to translucent solid fills on Android.

---

## 2. Typography Hierarchy

| Style Name | Size / Leading | Weight | iOS System Font | Android Substitute |
| :--- | :--- | :--- | :--- | :--- |
| **Large Title** | 34pt / 41pt | Bold (700) | SF Pro / SF Arabic | System / Inter Bold |
| **Title 1** | 28pt / 34pt | Bold (700) | SF Pro / SF Arabic | System / Inter Bold |
| **Title 2** | 22pt / 28pt | Bold (700) | SF Pro / SF Arabic | System / Inter Bold |
| **Title 3** | 20pt / 25pt | SemiBold (600)| SF Pro / SF Arabic | System / Inter SemiBold |
| **Headline** | 17pt / 22pt | SemiBold (600)| SF Pro / SF Arabic | System / Inter SemiBold |
| **Body** | 17pt / 22pt | Regular (400) | SF Pro / SF Arabic | System / Inter Regular |
| **Callout** | 16pt / 21pt | Regular (400) | SF Pro / SF Arabic | System / Inter Regular |
| **Subheadline** | 15pt / 20pt | Regular (400) | SF Pro / SF Arabic | System / Inter Regular |
| **Footnote** | 13pt / 18pt | Regular (400) | SF Pro / SF Arabic | System / Inter Regular |
| **Caption 1** | 12pt / 16pt | Medium (500) | SF Pro / SF Arabic | System / Inter Medium |
| **Caption 2** | 11pt / 13pt | SemiBold (600)| SF Pro / SF Arabic | System / Inter SemiBold |

*Note: All typography must support Dynamic Type / system font scale multipliers.*

---

## 3. Semantic Color Tokens

```typescript
export const DesignTokens = {
  colors: {
    light: {
      systemBackground: '#FFFFFF',
      secondarySystemBackground: '#F8FAFC',
      systemGroupedBackground: '#F1F5F9',
      secondarySystemGroupedBackground: '#FFFFFF',
      label: '#0F172A',
      secondaryLabel: '#64748B',
      tertiaryLabel: '#94A3B8',
      separator: '#E2E8F0',
      tint: '#0891B2',
      tintActive: '#0E7490',
      catAccent: '#0891B2',
      dogAccent: '#F97316',
      welfareRed: '#EF4444',
      successGreen: '#10B981',
    },
    dark: {
      systemBackground: '#0F172A',
      secondarySystemBackground: '#1E293B',
      systemGroupedBackground: '#0B1120',
      secondarySystemGroupedBackground: '#1E293B',
      label: '#F8FAFC',
      secondaryLabel: '#94A3B8',
      tertiaryLabel: '#64748B',
      separator: '#334155',
      tint: '#06B6D4',
      tintActive: '#22D3EE',
      catAccent: '#06B6D4',
      dogAccent: '#FB923C',
      welfareRed: '#F87171',
      successGreen: '#34D399',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  touchTarget: {
    minHeight: 44,
    minWidth: 44,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 9999,
  },
};
```

---

## 4. Component Library Architecture
1. **IOSNavigationBar**: Large Title morphing on scroll with back chevron and action items.
2. **IOSGroupedList & IOSListRow**: Inset grouped style with SF Symbols, accessory disclosure indicators, switches, and detail values.
3. **IOSSegmentedControl**: Haptic-enabled tab switcher for species, roles, and layers.
4. **IOSButton**: Primary filled, secondary tinted, and destructive styles with `activeOpacity={0.7}`.
5. **WorkoutHUD (Survey Screen)**: Apple Fitness style workout card:
   - High-contrast tabular numbers (`fontVariant: ['tabular-nums']`).
   - Live elapsed time, distance in km, search pace (KM/H), and detections recorded.
   - Glassmorphic translucent map underlay.
6. **ProgressRing & MetricTile**: Circular SVG progress indicators for gamification XP and levels.

---

## 5. Right-to-Left (RTL) Arabic Guidelines
- In Arabic (`ar-TN`), all layouts mirror horizontally:
  - Navigation bar titles align to the right; back arrows flip to point to the right.
  - Grouped lists place disclosure chevrons on the far left and leading icons on the far right.
  - Progress bars fill from right to left.
- Numeric indicators use tabular Western Arabic numerals by default, with an in-app setting for Eastern Arabic numerals.
