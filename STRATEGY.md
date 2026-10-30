# Rendering and route strategy

The application uses the Next.js App Router. Browser-storage records are read after hydration because `localStorage` and `sessionStorage` are browser APIs. Interactive pages therefore use Client Components or compose Client Components for their controls. The root layout and home page are Server Components unless their imported interactive child components establish a client boundary. There is no database/API fetch, ISR, or server-side user data in this version.

| Route | Access | Rendering/data strategy |
| --- | --- | --- |
| `/` | Public | App Router page composed with client search, announcement, and featured-car components; storage-derived content loads in the browser. |
| `/cars` | Public | Catalogue shell with client search params, filters, sorting, pagination, Leaflet map, and browser-storage catalogue data. |
| `/cars/[id]` | Public | Client-loaded car detail using route ID and browser storage; a not-found state handles missing cars. |
| `/signin` | Public | Client form reads and writes the browser demo session, then navigates to a safe internal path. |
| `/signup` | Public | Client form creates a demo renter record in browser storage. |
| `/dashboard` | Renter | Client-loaded summary filtered to the current renter ID. |
| `/bookings` | Renter | Client-loaded booking history, search/status/car/date filters, and renter-scoped CSV export. |
| `/bookings/[id]` | Booking renter | Client-loaded detail checks the session renter ID against the record before rendering it. |
| `/bookings/[id]/confirmation` | Booking renter | Client-loaded confirmation repeats the renter ownership check. |
| `/checkout` | Renter | Client-only mock checkout reads a sessionStorage draft and creates a booking through the domain helper. |
| `/owner` | Owner | Client-loaded owner metrics, Recharts earnings/utilization, and scoped CSV report. |
| `/owner/cars` | Owner | Client-loaded listing collection filtered by owner ID. |
| `/owner/cars/new` | Owner | Client form/domain action stores a pending listing. |
| `/owner/cars/[id]/edit` | Listing owner | Client-loaded form and update action recheck current ownership and listing status. |
| `/owner/cars/[id]/bookings` | Listing owner | Client-loaded requests for an owned car, guarded transitions, review replies, and scoped export. |
| `/admin` | Admin | Client-loaded administration dashboard: moderation, user status, all bookings, reports/charts, announcements, and disputes. |

The brief suggests separate routes such as `/admin/listings`, `/admin/users`, `/admin/bookings`, and `/admin/reports`. In the current application these functions are consolidated into sections on `/admin`; those separate routes are not implemented. Similarly, owner earnings currently appear on `/owner`, not `/owner/earnings`.

Dynamic segments are resolved by Next.js route files and consumed on the client where browser storage is required. These pages do not claim database-backed static generation or incremental revalidation. Metadata lives in the root layout and public page metadata where declared. No Route Handlers or Server Actions are used because this implementation has no backend.
