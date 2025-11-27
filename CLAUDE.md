# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgendaGrupal (reconect) is a group calendar coordination app where users can:
- Sign in with Google
- Create/join groups using shareable codes
- Mark available dates and see group availability (traffic light system)
- Leave notes on specific days and mark favorites with stars
- Invite friends via email/Gmail

**Live URL:** https://planificador-grupal.web.app

## Commands

```bash
npm run dev      # Start local dev server (Vite HMR)
npm run build    # Build for production (outputs to dist/)
npm run lint     # Run ESLint
npm run preview  # Preview production build locally

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

## Architecture

### Single-File React App
The entire application lives in `src/App.jsx` (~1200 lines). It's a single-page app with no routing - view state is managed via a `view` state variable (`login`, `join`, `calendar`).

### Tech Stack
- **React 19** with Vite 7
- **Tailwind CSS 4** (via @tailwindcss/vite plugin)
- **Firebase**: Authentication (Google Sign-In), Firestore (realtime database), Hosting
- **lucide-react**: Icons

### Firebase Data Model

**Firestore Collections:**

`users/{uid}`:
```javascript
{
  displayName, email, photoURL,
  groups: ["ABC123", ...],  // Array of group IDs user belongs to
  createdAt
}
```

`calendar_groups/{groupId}`:
```javascript
{
  name, description,
  members: [{ uid, name, photoURL }, ...],
  votes: { "2025-01-15": ["uid1", "uid2"], ... },      // Date availability
  messages: { "2025-01-15": { "uid1": "note..." } },   // Per-user notes per date
  stars: { "2025-01-15": ["uid1"], ... },              // Favorite dates
  createdAt
}
```

### Key Patterns

- **Real-time sync**: Uses Firestore `onSnapshot` for live group data updates
- **Atomic updates**: Uses `arrayUnion` for adding members/groups, dot notation for nested field updates (`votes.${dateStr}`)
- **Traffic light colors**: 100% = green, >=50% = yellow, <50% = red
- **Email invites**: Opens Gmail compose with pre-filled invitation via URL scheme
- **Web Share API**: Native sharing on mobile, clipboard fallback on desktop

## Firebase Configuration

Firebase config is hardcoded in `src/App.jsx`. Project ID: `planificador-grupal`

To deploy, ensure Firebase CLI is logged in: `firebase login`
