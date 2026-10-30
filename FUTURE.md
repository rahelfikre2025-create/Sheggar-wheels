# Simulated features and future work

## Simulated or limited

- Authentication is a seeded demo account selector/credential check backed by sessionStorage, not real authentication.
- Users, cars, bookings, reviews, disputes, and announcements live in editable localStorage, not a shared database.
- Checkout is a TeleBirr simulation only; it stores a fake `DEMO-TB-*` reference. No card, PIN, TeleBirr, bank, or other payment credentials are collected, no payment service is contacted, and no charge/refund actually occurs.
- Booking `fee` is currently zero. Admin commission reporting sums recorded fee snapshots and therefore reports zero until a documented demo fee rule is implemented.
- Car locations use sample Addis Ababa coordinates; tracking is a predefined simulation, not GPS.
- State updates are local and cross-tab refresh is best effort; there is no push notification/realtime service.
- Documentation still needs current screenshots, a deployed URL, and actual Lighthouse results.

## Prioritized next steps

1. Complete manual negative/positive workflow testing and record Lighthouse results.
2. Capture accessible desktop/mobile screenshots and deploy the frontend; update README with verified links.
3. Decide and document a transparent fee/commission policy before showing non-zero mock commission.
4. Move records to a database and domain actions to validated server endpoints/transactions; add real server-side authorization.
5. Integrate a real payment provider only through a secure backend and appropriate compliance process.
6. Add audit history, listing evidence/identity checks, notifications, cancellation policies, and real dispute workflow.
7. Review third-party image/map availability, privacy, data retention, and accessibility as the app grows.
