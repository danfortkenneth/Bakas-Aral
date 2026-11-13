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

All 36 characters (A–Z and 0–9) live in `constants/traceableData.ts` as stroke
definitions. `buildCharacter()` smooths each stroke (Catmull-Rom) and derives the
SVG `path`, the hit `points` spread by arc length, and the `segments` used for
"is the finger on the stroke?" checks — all inside the 400×600 viewBox used by the
tracing screens.

`constants/characterLibrary.ts` layers the optional assets on top (anchor word,
image, sounds). Only **A** and **B** currently ship with artwork/audio; every other
character falls back to a text badge and silence.

To add artwork or audio for another character, drop the files in `assets/` and add
an entry to `CHARACTER_ASSETS` — no screen changes needed.

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

**Haptics are a core feature**, not decoration:

- a `Medium` impact every time a guide dot is reached,
- a light `selectionAsync()` tick roughly every 38 viewBox units while the finger
  stays on the line, so the stroke can be felt under the finger,
- a throttled `Warning` buzz (max ~3/second) when the finger leaves the line.

Finishing a character unlocks the **sticker card** for that anchor word. The
card waits ~400 ms, then fades/springs in while the stars pop one by one, and it
stays non-interactive until it is visible.

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
