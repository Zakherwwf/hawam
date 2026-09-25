# Gamification System: Scientific Integrity & Motivation Architecture

## 1. Principles
The gamification system is engineered to motivate sustained, methodical scientific survey effort without incentivizing bad scientific behavior:
- **No incentive to inflate animal counts**: XP for animals logged is small (+2 XP) and capped at 20 XP per session.
- **Equal reward for non-detections**: Complete surveys with zero animals seen receive the exact same completion bonus (+20 XP) as high-count surveys.
- **Incentivize spatial exploration**: Extra XP for surveying unvisited H3 resolution-9 hex cells (+15 XP) fixes urban coverage bias.
- **Incentivize longitudinal repeats**: Extra XP for repeating fixed transect routes (+15 XP) generates the multi-season repeat data needed for occupancy models.

---

## 2. XP Table

| Action | XP Award | Frequency / Cap | Scientific Objective |
| :--- | :--- | :--- | :--- |
| **Structured Survey Effort** | 10 XP per 10 min walked | Capped at 60 XP / session | Encourages standard 30–60 min walking transects |
| **Complete Checklist Bonus** | +20 XP | Per complete session | Follows eBird complete protocol; enables occupancy models |
| **Zero-Count Complete Survey** | +20 XP | Per complete session with 0 animals | Eliminates bias against reporting empty areas |
| **Animal Logged in Survey** | +2 XP | Capped at 20 XP / session | Prevents duplicate logging while rewarding data entry |
| **Complete ID Photo Set** | +5 XP | Per individual (Left + Right + Face) | Essential for photographic capture-recapture (Mark-Resight) |
| **Resighting of Known Animal** | +8 XP | Per validated resight link | Builds longitudinal individual capture histories for SECR |
| **New H3 Hex Explored (Res 9)** | +15 XP | First survey in ~0.1 km² cell | Fixes spatial sampling bias |
| **Fixed Route Repeat** | +15 XP | Per repeat of official transect | Enables multi-season occupancy and N-mixture models |
| **Quick Sighting** | +2 XP | Per incidental record | Low barrier to entry for casual public participation |
| **Academy Module Passed** | +25 XP | Per module passed | Trains observers in ICAM BCS 1-5 and distance estimation |
| **Welfare Alert Submitted** | +10 XP | When triage information is complete | NGO partner intervention for injured/sick animals |

---

## 3. Levels & Scientific Rank Ladder (1–30)

| Level | XP Required | English Title | Arabic Title (تونس) | French Title |
| :--- | :--- | :--- | :--- | :--- |
| **1–5** | 0 – 300 | Newcomer Observer | راصد جديد | Observateur Débutant |
| **6–10** | 301 – 1,000 | Neighbourhood Watcher | حارس الحي | Veilleur de Quartier |
| **11–15** | 1,001 – 2,500 | Field Surveyor | مسّاح ميداني | Enquêteur de Terrain |
| **16–20** | 2,501 – 5,000 | Senior Field Surveyor | خبير مسح ميداني | Enquêteur Principal |
| **21–25** | 5,001 – 10,000 | Research Naturalist | باحث طبيعي | Naturaliste de Terrain |
| **26–30** | 10,001+ | Field Scientist | عالم ميداني | Scientifique de Terrain |

---

## 4. Badges (Data-Driven Definitions)

| Badge Identifier | Name | Tier | Criteria |
| :--- | :--- | :--- | :--- |
| `first_walk` | First Steps | Bronze | Complete 1 structured transect survey |
| `distance_10km` | 10 km Surveyor | Bronze | Survey 10 km total walking distance |
| `distance_50km` | 50 km Surveyor | Silver | Survey 50 km total walking distance |
| `distance_100km` | Century Walker | Gold | Survey 100 km total walking distance |
| `zero_hero` | Zero Hero | Silver | Complete 5 complete checklist surveys with 0 animals |
| `photo_pro` | Photographic Master | Silver | Record 25 full 3-angle photo sets (Left, Right, Face) |
| `recapture_master` | Mark-Resight Specialist | Gold | Confirm 10 resightings of previously registered animals |
| `explorer_50` | Terra Incognita | Gold | Survey in 50 distinct H3 resolution-9 hex cells |
| `route_guardian` | Route Guardian | Gold | Walk the same standardized fixed route 10 times |
| `governorate_pioneer`| Regional Pioneer | Gold | First observer to complete a survey in a new delegation |
| `academy_graduate` | Certified Surveyor | Bronze | Complete all 5 Field Academy modules with passing score |
| `welfare_guardian` | Guardian Angel | Silver | Submit 5 verified welfare alerts for sick/injured animals |

---

## 5. Weekly Streaks & Quests
- **Weekly Streaks**: Observers must complete at least 1 valid structured survey per calendar week. Weeklycadence prevents surveyor burnout compared to daily streaks.
- **Streak Freeze**: Users earn 1 "Streak Freeze" per calendar month to accommodate exams, illness, or severe weather.
- **Rotating Quests**: 3 personalized weekly quests generated per user based on their active governorate:
  1. *Spatial Quest*: "Survey 2 hex cells you have never visited before."
  2. *Methodological Quest*: "Capture a complete 3-angle photo set for a free-roaming dog."
  3. *Repetition Quest*: "Walk Route Tunis-Carthage Transect B."

---

## 6. Anti-Cheat & Scientific Validation
Server-side validation Edge Function (`validate_session`) enforces scientific integrity before awarding XP:
1. **Mock Location Detection**: Rejects sessions where Android mock location flag is true.
2. **Speed Gate**: Rejects walking transects with average speed > 8 km/h or instant speed spikes > 15 km/h.
3. **Teleport Detection**: Flags sessions where distance between consecutive points implies supersonic relocation.
4. **Implausible Density**: Flags sessions with > 50 animals recorded in under 100 meters.
5. **Daily XP Cap**: Maximum 250 XP per day per user account to mitigate bot automation.
