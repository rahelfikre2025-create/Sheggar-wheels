# Data model and persistence

All records are plain JavaScript objects/arrays. The browser is the source of truth for this demo; storage is not shared between browsers or devices.

## Entities

- **User:** `id`, `name`, `email`, `roles[]`, `status`, timestamps, optional status-change metadata. Roles may include both `renter` and `owner`; admin is a seeded role.
- **Car:** `id`, `ownerId`, make/model/year, location/neighbourhood, transmission, seats, daily price, image data, description, `status`, unavailable dates, and review/moderation metadata. Listing statuses include pending, approved, rejected, and inactive. Public catalogue visibility is limited to approved cars.
- **Booking:** `id`, `carId`, `renterId`, `ownerId`, start/end dates, duration, price snapshot, subtotal, fee, total, payment/checkout state, lifecycle status, and timestamps. The date interval is `[startDate, endDate)`.
- **Review:** booking/car/renter/owner references, rating/comment, optional owner reply, timestamps.
- **Dispute:** booking references, reporter, reason, state, resolution and timestamps.
- **Announcement:** title/message, active flag, creator and timestamp.

## Storage keys

| Key | Storage | Content |
| --- | --- | --- |
| `sw_users_v1` | localStorage | Seeded/demo accounts and user status |
| `sw_cars_v1` | localStorage | Seeded and owner-created listings |
| `sw_bookings_v1` | localStorage | Booking requests and lifecycle records |
| `sw_reviews_v1` | localStorage | Reviews and owner replies |
| `sw_disputes_v1` | localStorage | Reported issues and admin resolutions |
| `sw_announcements_v1` | localStorage | Admin announcements |
| `sw_session_v1` | sessionStorage | Current demo user ID only |
| `sw_checkout_draft_v1` | sessionStorage | Temporary car ID and selected dates |

## Helpers and rules

- `app/lib/storage.js`: `readStorage`, `writeStorage`, `initializeDemoData`, and typed array readers. Initialization seeds missing keys and preserves saved records. Read helpers fall back safely on malformed JSON and log a diagnostic; malformed existing account data can make initialization return an error instead of overwriting it.
- `app/lib/session.js`: session lookup, sign-in/out, role checks, safe internal return path.
- `app/lib/bookings.js`: date duration/pricing, overlap checks, booking validation/creation and allowed transitions.
- `app/lib/listings.js`: listing create/edit/approve/reject actions and their role/state checks.
- `app/lib/admin.js`: admin-only user status changes and owner-listing visibility changes on suspend/reinstate.
- `app/lib/milestones.js`: reviews, replies, disputes, announcements and CSV helper.

Bookings snapshot the current daily price. `fee` is currently ETB 0 in `calculatePrice`; admin monthly commission reports sum the fee snapshot rather than inventing a percentagez. Overlap checks block requested, confirmed, and in-progress bookings. Owners must recheck availability at approval.

## Recovery and limitations

Storage access and JSON parsing are wrapped in try/catch. Missing keys receive seed/fallback data. The app does not provide a reset/migration UI for corrupted records; a user can clear the relevant browser key to restore seed data. Browser storage is user-editable and can be unavailable (private-mode/quota settings), in which case helpers return errors and UI should show them. No password, payment credential, API secret, or real payment data belongs in these records.
