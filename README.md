# Bakas-Aral (NEU-Bakás)

A multi-sensory Filipino literacy app for **pre-kindergarten** learners. Children trace Filipino letters while getting haptic feedback, phonetic audio, and anchor words — and teachers/parents can track their progress.

Built with **Expo + React Native** and **Firebase**.

---

## Features

| Area | Description |
|---|---|
| **Bakás (Tracing)** | Letter/number tracing game with haptic + audio feedback |
| **Progress** | Accuracy and activity tracking per student |
| **Teacher Dashboard** | Manage classes, view student accuracy, generate QR codes |
| **Parent Dashboard** | Monitor a child's progress, sticker book, sandbox |
| **QR Scanning** | Parents scan a teacher-issued QR to link a student |
| **Admin Dashboard** | Account and system management |
| **Bilingual UI** | English / Filipino toggle |

## Tech Stack

- **Expo SDK 58** · React Native 0.88 · React 19 (New Architecture)
- **Expo Router** (file-based routing, typed routes)
- **TypeScript**
- **Firebase** — Auth + Firestore + Storage (web SDK)
- `expo-audio`, `expo-camera`, `expo-image-picker`, `expo-haptics`, `react-native-svg`, `react-native-qrcode-svg`

## Requirements

- Node.js 20+
- npm
- [Expo Go](https://expo.dev/go) or a development build
- Android Studio (optional, for `expo run:android`)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Add environment variables (see below)
#    Create a .env file in the project root

# 3. Start the dev server
npx expo start
```

Then press `a` for Android, `w` for web, or scan the QR with Expo Go.

### Environment Variables

Create `.env` in the project root. This file is **git-ignored** — never commit it.

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

Get these from **Firebase Console → Project Settings → Your apps**.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` | Build & run on Android (`expo run:android`) |
| `npm run ios` | Build & run on iOS (macOS only) |
| `npm run web` | Run in the browser |
| `npm run lint` | ESLint via `expo lint` |

## Project Structure

```
app/                     # Expo Router routes
  _layout.tsx            # Root layout: auth, language & user contexts
  index.tsx              # Welcome screen
  (auth)/                # Role selection, login, signup
  (tabs)/                # Home, Bakás, Progress, Teacher, Admin
  parent-dashboard/      # Parent home, progress, QR scanner, sticker book, sandbox
components/              # Shared UI components
constants/               # Theme, avatars, traceable characters
hooks/                   # Theme / color-scheme hooks
lib/                     # Firebase init, classroom & parent sync helpers
services/                # Data services
```

## Tracing characters

The geometry for all 36 characters (A–Z and 0–9) lives in
`constants/traceableData.ts`. `buildCharacter()` smooths each stroke (Catmull-Rom) and derives the
SVG `path`, the hit `points` spread by arc length, and the `segments` used for
"is the finger on the stroke?" checks — all inside the 400×600 viewBox used by the
tracing screens.

`constants/characterLibrary.ts` layers the optional assets on top (anchor word,
image, sounds). Only **A** and **B** currently ship with artwork/audio; every other
character falls back to a text badge and silence.

> **Focus build:** only **A, B, C** and the numbers **1, 2** are enabled right now.
> The active set is defined once by `LETTERS` / `NUMBERS` in `characterLibrary.ts`;
> the home grid, tracing screens and both progress screens all read from it. The
> full geometry is still in `traceableData.ts`, so restoring the other characters
> only means extending those two lists.

To add artwork or audio for another character, drop the files in `assets/` and add
an entry to `CHARACTER_ASSETS` — no screen changes needed.

### Tracing visuals

`components/TraceCanvas.tsx` draws the play area shared by both tracing screens:
a dark-teal character with a white sticker outline, white checkpoint dots, and a
purple patterned fill that grows **along the covered guide segments** (so it
stays inside the letter even when a child's finger wanders). A faint dashed
centreline shows the route and fades as the child fills it, and a **demo bee**
traces the whole character once before the first touch. A bee follows the finger
after that, and a beehive marks the end of the current stroke — the friendly cue
that replaces direction arrows. Game rules are unchanged: dots, coverage, haptics,
undo and the sticker reward are still driven by the screens.

A side **speaking avatar** (`components/SpeakingAvatar.tsx`) gives the child a
short instruction, says the character's sound twice when a trace starts
(`PHONETIC_PHRASES`), and says the anchor line when the character is finished
("A for Apple!" / "A para sa Atis!" from `FINISH_PHRASES`). It uses the device's
own text-to-speech via `expo-speech` (Filipino voice when available, English
fallback otherwise), so it works offline and needs no API key. The avatar picture
lives in `assets/images/student-avatar.png`; the higher pitch (1.5) makes the
device voice sound more childlike. Swap in generated child-voice audio later if
you want a more natural read.

### Completion and reward

A character only finishes when the learner has actually traced it:

- **every** guide dot must be reached,
- at least 70% of the guide line actually traced,
- at least 8 move samples (a single tap can never finish).

To keep that fair for a real child's hand, the **first and last dot of each
stroke** use a wider radius (`ENDPOINT_TOLERANCE = 90`) than the interior dots
(`TRACE_TOLERANCE = 55`) — starting or stopping a little off the mark still
counts. `lib/tracing.ts` holds these rules plus `fitTracingCanvas()`, which keeps
the drawing area at the character's 2:3 aspect ratio so touch coordinates map
1:1 to the 400×600 viewBox.

**Undo** removes the last stroke and replays the remaining strokes through
`analyseStrokes()`, so the dots, coverage and accuracy always match what is on
screen. A child can fix a wrong stroke without starting over.

**Haptics are a core feature**, not decoration. All patterns live in
`lib/haptics.ts` and can be turned off from **Teacher → Haptic Feedback**:

- a firm `Heavy` impact when a stroke starts,
- a `Medium` impact plus a quick double tick at every guide dot,
- a light **curve-aware texture**: ticks get denser on turns and are capped at
  ~10/second (so the child can feel the shape of the stroke),
- a two-pulse "stroke done" pattern when the finger lifts after a real stroke,
- a throttled `Warning` buzz when the finger leaves the line, and a distinct soft
  confirmation when it comes back,
- a `Success` celebration when the character is finished, followed by a short
  **replay of the drawn stroke rhythm** so the letter can be remembered by touch.

Only real strokes count toward completion — isolated dot taps are ignored by
`analyseStrokes()` (a stroke needs ≥6 samples and ≥60 viewBox units), and every
stroke of the character must be traced before the reward unlocks.

Finishing a character shows a clean **star-only reward**: a small frosted pill
with the three stars popping one by one (large centre star), fading/springing in
after ~400 ms. No anchor artwork, word label, accuracy text, or success mp3 — the
avatar says the anchor line instead, and a **Retry / Continue** bar sits above
the tab bar so the finished letter stays visible.

## Device support

The app is portrait-only and works from 320 dp phones up to 12.9" tablets:

- `lib/responsive.ts` provides `useResponsive()` (live width/height, tablet and
  small-phone flags) plus `scaleFor()`/`normalizeFor()`. Text grows gently on
  phones and is capped at 1.35× on tablets, so it never doubles.
- The tracing canvas is re-fitted on every layout change and reserves space for
  the header and the floating tab bar, so every guide dot stays reachable and
  touch coordinates keep mapping 1:1 to the 400×600 viewBox.
- The tab bar sizes its slots from the live window width, so all five tabs fit a
  320 dp screen.
- Auth, welcome and role-selection screens scroll instead of clipping on short
  screens; the sticker reward card scrolls inside a height-capped overlay.
- Safe-area insets come from the single root `SafeAreaProvider` in
  `app/_layout.tsx` (screens must not add their own provider).

## Roles

- **Parent / Magulang** — monitor a child's progress and activities
- **Teacher / Guro** — manage classes and track each child's accuracy
- **System Admin** — manage system settings and accounts

## Troubleshooting

**Metro cache issues**

```bash
npx expo start --clear
```

**Dependency mismatch after upgrading Expo**

```bash
npx expo install --check
npx expo-doctor
```

**Type check / lint**

```bash
npx tsc --noEmit
npm run lint
```

## Notes

- `android/` and `ios/` are generated native folders and are git-ignored. Run `npx expo prebuild` if you need to regenerate them.
- The app uses the **Firebase JS SDK** (`firebase/*`). The native `@react-native-firebase/*` packages are intentionally not used.
