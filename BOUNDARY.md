# Server and client boundary

## Server-rendered shell

- `app/layout.jsx` is a Server Component. It imports global CSS, loads the self-hosted Next font configuration, and provides document metadata and the HTML/body shell.
- `app/page.jsx` is a Server Component page that composes the home experience. Interactive child components create their own client boundaries.
- Public catalogue page wrappers can remain Server Components while `CarCatalogue` handles search params and browser storage in a Client Component.

## Client Components

The following areas need state, event handlers, browser storage, or browser-only map/chart work:

- `app/components/site-header.jsx`, `car-search.jsx`, `car-catalogue.jsx`, `car-card.jsx`, `featured-cars.jsx`, `announcements.jsx`, and `rental-quote.jsx`.
- `app/components/leaflet-map.jsx` dynamically imports Leaflet in an effect and uses the browser DOM and map tiles.
- Sign-in/sign-up, renter dashboard and booking pages, checkout/confirmation, owner tools, and the admin dashboard.
- `app/lib/storage.js`, `session.js`, `bookings.js`, `listings.js`, `admin.js`, and `milestones.js` are browser-oriented data/domain helpers. They guard browser storage access; they are not server authorization services.

## Data flow

Client pages call domain helpers. Helpers re-read the current session and relevant records before writes. The helpers return `{ ok, ... }` results for UI feedback. localStorage updates do not trigger same-tab storage events, so pages refresh local state after their own actions and may listen to `storage`/`focus` for changes made elsewhere.

Server Components cannot read localStorage. Server-rendered output should therefore remain storage-independent; client components load user-specific data after hydration. If the project moves to a backend, move authorization and validation into server-side handlers and treat client checks as presentation only.
