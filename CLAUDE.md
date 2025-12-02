# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgendaGrupal is a PWA for coordinating dates between groups. Users can create/join groups, mark availability on a calendar, chat, and see group-wide availability using a traffic-light system.

**Live:** https://planificador-grupal.web.app

## Commands

```bash
# Development
npm run dev              # Start dev server at localhost:5173
npm run lint             # Run ESLint
npm run preview          # Preview production build locally

# Build & Deploy
npm run build            # Build for production (outputs to /dist)
firebase deploy --only hosting    # Deploy frontend
firebase deploy --only functions  # Deploy Cloud Functions

# Cloud Functions (from /functions directory)
cd functions && npm run serve    # Local emulator
cd functions && npm run deploy   # Deploy functions
```

## Architecture

### Single-File Frontend
The entire frontend is in `src/App.jsx` (~3700 lines). View state managed via `view` variable: `login`, `join`, `calendar`.

### Tech Stack
- **Frontend:** React 19, Vite 7, Tailwind CSS 4
- **Backend:** Firebase (Auth, Firestore, Hosting, Functions, Cloud Messaging)
- **Icons:** lucide-react

### Cloud Functions
`functions/index.js` contains `onGroupUpdate` - Firestore trigger that sends FCM push notifications for new chat messages.

## Data Model (Firestore)

**`users/{uid}`:**
```javascript
{
  displayName, email, photoURL,
  groups: ["ABC123"],
  blockedDays: { "2025-01-15": "reason" },
  confirmedPlans: { "2025-01-15": { groupId, title } },
  lastSeenMessages: { "groupId": { "_general": 5, "2025-01-15": 3 } },
  fcmTokens: ["token"],
  notificationsEnabled: true
}
```

**`calendar_groups/{groupId}`:**
```javascript
{
  name, description,
  members: [{ uid, name, photoURL }],
  votes: { "2025-01-15": ["uid1", "uid2"] },
  messages: { "2025-01-15": [{ uid, name, text, timestamp }] },
  generalChat: [{ uid, name, text, timestamp }],
  stars: { "2025-01-15": ["uid1"] }
}
```

## Environment Variables

Firebase config uses env variables. Copy `.env.example` to `.env`:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
```

Note: `public/firebase-messaging-sw.js` has hardcoded config (service workers can't access env vars).

## Key Implementation Details

- **Traffic light:** Green (100%), Yellow (≥50%), Red (<50%)
- **Group codes:** 6-char alphanumeric, client-generated
- **Real-time:** Firestore `onSnapshot` listeners
- **iOS PWA:** Special install prompts, notifications require iOS 16.4+
- **Safe areas:** Uses `env(safe-area-inset-top)` for notch compatibility
- **Icon generation:** `node generate-icons.cjs` creates PWA icons from SVG
