# UI & Interaction Design Specification: Hawem (حايم)

## 1. Design Language & Principles
The Hawem user interface follows Apple Human Interface Guidelines (HIG) with a Cupertino-first design system ("Liquid Glass" aesthetic):
- **Typography**: San Francisco system fonts with structured type hierarchy (`largeTitle`, `title2`, `headline`, `subheadline`, `caption1`, `caption2`).
- **Color Palette**:
  - `systemTeal` (`#0891B2`): Primary scientific brand accent.
  - `systemBlue` (`#0284C7`): Informational and transect route geometry.
  - `systemIndigo` (`#4F46E5`): Field Academy and educational badges.
  - `systemViolet` (`#7C3AED`): Managed cat colonies and TNR feeding stations.
  - `systemOrange` (`#D97706`): Alert statuses and dog observations.
  - `systemGreen` (`#10B981`): Complete surveys, health certifications, and successes.
- **Micro-Interactions**: Haptic feedback on tap, spring modal presentations, and segmented controls for instant view switching.

---

## 2. Component Hierarchy & Navigation Map

```
App.tsx (Root SafeAreaProvider)
├── Main Tabs (Cupertino Tab Bar)
│   ├── Tab 1: MapOverviewScreen
│   │   ├── InteractiveMapView (Mapbox GL JS v3)
│   │   │   ├── Sighting Pins (Cat: Amber / Dog: Orange)
│   │   │   ├── Colony Pins (Violet #7C3AED with TNR badge)
│   │   │   └── Active Transect Path (Cyan #06B6D4)
│   │   └── Quick Sighting FAB (Bottom Floating Action Button)
│   ├── Tab 2: StructuredSurveyScreen
│   │   ├── WorkoutHUD (Time, Speed km/h, Distance km, Cadence)
│   │   ├── RoutePickerModal ("Adopt a Route" Catalog)
│   │   ├── Off-Corridor Deviation Warning Banner (> 50m)
│   │   ├── BearingDistanceInput (Radial compass + distance slider)
│   │   └── SurveySummaryModal (3 Concentric Workout Rings + XP breakdown)
│   ├── Tab 3: AnimalsScreen
│   │   ├── Top Segmented Control [ Known Individuals (N) | All Sightings (M) ]
│   │   ├── Known Individuals Grid (Photo, Nickname, TNR Status, Colony tag)
│   │   └── Sightings CRUD Table (Distance editor, group size, notes, photo viewer, delete modal)
│   ├── Tab 4: ProgressScreen
│   │   ├── Level & Scientific Rank Hero Card (Level 1-7, XP bar)
│   │   ├── Streak & Freeze Row (Interactive Monthly Freeze activation)
│   │   ├── Weekly Quests List (Active criteria + progress bar)
│   │   ├── Surveyor Badges Grid (Interactive Badge Inspection Modal)
│   │   └── Effort-Based Leaderboard (Ranked by KM / Complete Surveys)
│   └── Tab 5: AccountScreen
│       ├── Surveyor Profile Card (Name, Organization, Surveyor ID)
│       ├── Contribution Metrics (Surveys, Kilometers, Animals)
│       ├── Data Synchronization Group (Real sync status, "Sync Now", DwC-A / SECR share)
│       ├── Preferences & Language (EN / FR / AR)
│       └── Settings & Privacy Calibration Link
└── Modals (Presented via activeModal)
    ├── Modal: OpportunisticScreen (Quick Log + Gemini AI Vision Assist)
    ├── Modal: GuidedPhotoScreen (3-Angle Camera Guide: Left, Right, Face)
    ├── Modal: TrainingScreen (Field Academy 5 Modules + Certification Exam)
    ├── Modal: SettingsScreen (1km² grid toggle, GPS threshold, cache tools)
    └── Modal: DesignGalleryScreen (HIG UI Component Showcase)
```

---

## 3. Reactive State Variables & Store Contracts

### 3.1 AI Vision State (`OpportunisticScreen.tsx` / `useVisionStore`)
- `isAnalyzing`: `boolean` — Activity indicator during Gemini multimodal processing.
- `aiAnalysis`: `AnimalVisionAnalysis | null` — Extracted metadata.
- `aiConfidence`: `number` (0.00 – 1.00).
- `aiApplied`: `boolean` — Tracks whether surveyor accepted the AI suggestions.

### 3.2 Post-Survey Debrief State (`SurveySummaryModal.tsx`)
- Concentric Rings:
  - `ringEffortProgress`: $\min(1.0, \frac{\text{seconds}}{1800})$ (Green `#10B981`)
  - `ringDistanceProgress`: $\min(1.0, \frac{\text{km}}{2.0})$ (Teal `#0891B2`)
  - `ringCompletenessProgress`: $1.0$ if eBird complete protocol, $0.5$ if incidental (Amber `#F59E0B`)

### 3.3 Surveyor Badges & Freeze State (`ProgressScreen.tsx`)
- `selectedBadge`: `Badge | null` — Triggers modal presentation with badge tier, criteria, and unlock timestamp.
- `freezesAvailable`: `number` — Decremented on confirmed monthly freeze activation.

---

## 4. Accessibility & Inclusive Design (WCAG 2.1 AA)
- Minimum tap target of $44 \times 44$ pt for all interactive buttons and segmented controls.
- Full RTL (Right-to-Left) Arabic localization support with native layout flipping and Arabic numerals.
- High-contrast text labels adhering to $> 4.5:1$ contrast ratio against background cards.
