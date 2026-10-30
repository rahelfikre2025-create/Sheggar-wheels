# Demo access and authorization

## Session model

Sign-in verifies the selected demo email/password and role against the seeded user list. The app stores only the user ID in tab-scoped `sessionStorage` under `sw_session_v1`; password strings are not stored. `getCurrentSession()` resolves the ID against `sw_users_v1` and clears the session if the account is missing or suspended. Sign-out removes session and checkout-draft keys. `safeReturnPath()` permits same-site internal paths and rejects protocol-relative, external, backslash, encoded slash, and control-character paths.

## Role and ownership checks

- Renter booking creation checks active session, renter role, valid future dates, approved car, active owner, unavailable dates, and overlapping active bookings.
- Booking transitions re-read session, booking status, car, dates, role, ownership, and conflicts before changing a booking.
- Owner listing edits and booking responses check that the signed-in owner owns the car/booking.
- Admin approval and rejection recheck active admin status and pending listing state. Rejection requires a 3–500 character reason.
- Admin account management rechecks an active admin, validates the target/status, prevents self-suspension, and protects the last active admin. Suspending an owner marks their listings inactive and reinstatement restores their previous listing status.
- Export handlers recheck the current actor and scope records to that actor where the data is user-owned.

## Required negative-test scenarios

These are manual test scenarios from the capstone brief. They are documented here but have not been recorded as executed in this update.

1. **Signed-out write:** call `createBooking()` with no `sw_session_v1`. Expected: it returns an error and `sw_bookings_v1` is unchanged.
2. **Wrong owner / changed URL:** sign in as Owner A and try to edit or respond to Owner B's car ID. Expected: domain helper refuses the write and Owner B's record is unchanged.
3. **Renter privacy:** sign in as Renter A and navigate to a booking ID belonging to Renter B. Expected: generic unavailable/not-found state and no booking information is exposed.

Additional moderation checks: try rejecting a non-pending listing, suspending the current admin, and suspending the last active admin; each action should be refused.

## Security limitation

This is a frontend-only simulation. localStorage/sessionStorage can be changed with browser developer tools, bundled code is public, and there is no server-side authorization. These checks demonstrate expected UI/domain behavior and are not production security. Do not use real passwords, personal information, or payment data.
