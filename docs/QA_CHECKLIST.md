# QA checklist & panel demo

## 1. Device / platform matrix

| Width | Profile | Platform | What to verify |
|---|---|---|---|
| 320 px | Small phone | Android / iOS | 4-column grid, tab bar fits, no horizontal scroll |
| 390 px | Phone | Android / iOS | Canvas fit, dots reachable, star reward inside viewport |
| 768 px | Tablet | iPad / Android | 6-column grid, centered canvas |
| 1024 px | Small desktop | Web | Centered app shell, 8-column grid |
| 1920 px | Wide desktop | Web | Content stays max 1200 px, no edge-to-edge stretch |

Also test each of the above with **offline** and **online** network states.

## 2. Functional test cases

| # | Case | Expected |
|---|---|---|
| 1 | First open | Privacy onboarding appears; Continue disabled until consent is checked |
| 2 | Second open | Onboarding is skipped |
| 3 | EN / PH toggle | Avatar says "A for Apple!" / "A para sa Aso!" and reveal image changes |
| 4 | Trace A normally | Demo bee plays once; all dots reached; violet fill follows finger |
| 5 | Tap dots only | Never finishes (anti-tap rule) |
| 6 | Trace only A's legs | Never finishes; crossbar stroke still required |
| 7 | Off-path finger | Red rim + throttled warning haptic; returning gives soft confirmation |
| 8 | Undo | Last stroke removed; dots, fill, accuracy recalculated |
| 9 | Finish | Stars pop one by one; anchor images replace dots one by one |
| 10 | Parent practice hub | Free pick works; "Practice all" advances through characters |
| 11 | QR sync | Teacher QR → parent dashboard; invalid QR rejected |
| 12 | Offline | Progress saved locally; no spinner stuck; sync resumes later |

## 3. Automated evidence

Run:

```bash
node scripts/simulate-tracing.js
npx tsc --noEmit
npx expo lint
npx expo export --platform android
npx expo export --platform web
```

Current expected simulation output:

```
careful     : ALL 36 PASS
normal      : ALL 36 PASS
sloppy      : ALL 36 PASS
very sloppy : ALL 36 PASS
dot taps    : 0/36 completed (expected 0)
A legs only : blocked (expected)
```

## 4. Three-minute panel demo script

1. **Open app** — show privacy onboarding, accept consent.
2. **Home** — show EN/PH toggle and the character grid.
3. **Tap A** — bee auto-demos the route once.
4. **Trace A** — deliberately go slightly off-path to show haptic warning and red rim, then return.
5. **Finish** — avatar says "A for Apple!" (or PH line), dots turn into apple images one by one, stars pop.
6. **Undo/redo** — show a wrong stroke can be corrected.
7. **Parent view** — practice hub, guided set, QR sync.
8. **Teacher view** — Learning Outcomes card, progress/accuracy, QR report.
9. **Close** — state the guarantees: offline-first, no ads, no child data to LLM, all 36 characters restoreable.

## 5. Known limitations

- iPads and browsers have no haptic motor — visual + audio cues are used instead.
- Web QR camera falls back to QR image upload.
- Filipino TTS voice depends on the device; a recorded child voice is pending.
