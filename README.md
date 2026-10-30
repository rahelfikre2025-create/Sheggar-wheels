# Sheggar Wheels

Sheggar Wheels is a responsive frontend capstone for a peer-to-peer car rental marketplace in Addis Ababa. Visitors can browse approved cars; renters can request trips and review their booking history; owners can manage listings and booking requests; and an administrator can moderate listings, manage demo users, inspect platform bookings, and view reports.

This is a frontend demonstration. Records persist in browser storage. Authentication, owner-provided payment instructions, demo payment references, location data, and platform commission are simulated; the app does not process payments or provide production-grade authorization.

## Features

- Car search, neighbourhood/date filters, sorting, URL sharing, pagination, and Leaflet map.
- Demo renter registration/sign-in, pending booking requests, owner approval or decline, owner-provided TeleBirr/bank instructions, renter demo-reference submission, owner payment verification, and booking history CSV.
- Owner listing creation/editing before approval, booking response, earnings/utilization charts, and CSV exports.
- Admin listing approval/rejection, demo user suspension/reinstatement, all-booking table, monthly booking/commission reports, CSV export, announcements, and dispute resolution.
- Responsive layouts, loading/empty/error messages, role-aware navigation, and local browser persistence.

## Screenshots and deployment

- Screenshots: not yet captured or committed. Add desktop and mobile screenshots to `docs/screenshots/` before portfolio submission.
- Live URL: not deployed yet.

## Technology

- Next.js 16 App Router, React 19, JavaScript, and CSS.
- Recharts for dashboard reports; Leaflet with OpenStreetMap tiles for maps.
- `localStorage` for demo records and `sessionStorage` for the current tab's demo session and checkout draft.

## Run locally

Use Node.js 20.9 or newer (Next.js 16 requirement).

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Demo accounts

All accounts use the shared demo password `Wheels2026!`. The password is a public demo credential and is not stored in user records.

| Role | Email |
| --- | --- |
| Renter | `renter1@sheggarwheels.com` |
| Owner | `owner1@sheggarwheels.com` |
| Administrator | `admin@sheggarwheels.com` |

All seeded cars belong to the single owner demo account. Older browser data is consolidated to that owner when the app initializes.

Use the administrator sign-in route or select the admin role flow. Public registration cannot assign the admin role.

## Documentation

- [`SRS.md`](SRS.md): requirements and core workflows.
- [`STRATEGY.md`](STRATEGY.md): route rendering and data strategy.
- [`BOUNDARY.md`](BOUNDARY.md): server/client component boundary.
- [`AUTH.md`](AUTH.md): demo access checks and negative-test scenarios.
- [`DATA.md`](DATA.md): entities, storage keys, data flow, and recovery.
- [`PERF.md`](PERF.md): performance measurement record and procedure.
- [`FUTURE.md`](FUTURE.md): simulations, limitations, and next steps.

## Known limitations

- Browser storage is editable by the user and is not shared between devices.
- Demo sessions are not secure authentication; frontend checks are not server authorization.
- Booking requests collect no payment. After owner approval, the renter can submit a demo payment reference and the owner must verify it before the booking becomes confirmed. The app never asks for a renter's PIN, password, card number, or bank login, and it does not process a charge. Booking fee snapshots currently use ETB 0, so commission reporting displays the recorded fee and currently totals zero unless fee snapshots are changed.
- Map coordinates and trip tracking are illustrative; map tiles require a network connection to OpenStreetMap.
- Screenshots and a deployed URL remain to be added after deployment.
