# Gather

A private messenger built around plans: conversation in the middle, confirmed details beside it.

## Run

Requires Node 22.13+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open [Gather](http://127.0.0.1:5312). Vite runs on port 5312; the API runs on 5313. Both bind to loopback.

```sh
npm run check   # Domain tests, TypeScript, production build
npm run format  # Format the source
npm run build
npm start       # Serve the built app at http://127.0.0.1:5313
```

## Included

- Private event rooms with persistent chat and a fixed plan summary.
- Guest invite links, no account required. Guests enter a display name.
- Going / Maybe / Can’t make it, optional constraints, and unanswered RSVPs.
- Date availability, overlap bars, host-controlled date locking, and calendar export.
- Proposals that become confirmed decisions when half the members vote yes, rounded up.
- Claimable tasks, host assignment, and completion tracking.
- Shared expenses in integer cents; equal splits preserve rounding remainders. Settlement only records payments made elsewhere.
- Meeting points, directions, and arrival updates.
- In-app notifications for date locks, assignments, location changes, and RSVP nudges. Nudges are limited to one per room per day; chat does not generate notifications.
- Search, a calendar, responsive layouts, keyboard navigation, and reduced-motion support.

New organizing sessions start as Alex Morgan with four fictional plans. New sessions opened through an invitation start without sample plans and use the guest’s name. The sample dates are in October and November 2026. The status changes to “It’s happening” once the date is locked and three people are going.

## Storage and boundaries

The Express API stores sessions and plans in `data/gather.sqlite` using Node’s built-in SQLite driver. Refreshing or restarting preserves data. `GATHER_DB` overrides the database path; `PORT` overrides the production/API port. The development proxy expects port 5313.

Sessions use an HTTP-only, same-site cookie. Membership and host permissions are checked on the server. Each invitation grants guest access to one room; guests cannot fetch its invitation token or change host-controlled details. The client polls every four seconds while visible.

This is a working local MVP. Invite links work between browser sessions that can reach the same server; localhost links cannot be opened on friends’ devices. The app has not been publicly deployed. Production use needs HTTPS, organizer identity and account recovery, invite revocation, rate limits, and a deployment/backup strategy. Notifications currently stay inside the app; email and push are not connected.

Natural-language availability parsing, co-planner roles, a day-of broadcast, and external calendar account connections are deferred. Calendar downloads work with Apple, Google, and other apps that import `.ics` files.

## Structure

`src/` contains React, TypeScript, and the UI. `server/index.js` exposes the API, `server/plans.js` enforces plan rules, and `server/store.js` owns persistence. Tests cover access boundaries, voting, date validation, tasks, nudges, money, and persistence. The coastal illustration is a local SVG; typefaces load from Google Fonts with local fallbacks.
