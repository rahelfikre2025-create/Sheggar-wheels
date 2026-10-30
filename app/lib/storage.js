import { cars as initialCars } from "@/app/lib/data/cars";

export const STORAGE_KEYS = {
  users: "sw_users_v1",
  cars: "sw_cars_v1",
  bookings: "sw_bookings_v1",
  reviews: "sw_reviews_v1",
  disputes: "sw_disputes_v1",
  announcements: "sw_announcements_v1",
};

export const SESSION_KEYS = {
  session: "sw_session_v1",
  checkoutDraft: "sw_checkout_draft_v1",
};

// Seeded account records. No password is stored in user records.
export const initialUsers = [
  {
    id: "renter-1",
    name: "Renter One",
    email: "renter1@sheggarwheels.com",
    roles: ["renter"],
    status: "active",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "owner-1",
    name: "Owner One",
    email: "owner1@sheggarwheels.com",
    roles: ["owner", "renter"],
    status: "active",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "admin-1",
    name: "Administrator",
    email: "admin@sheggarwheels.com",
    roles: ["admin"],
    status: "active",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
];

const defaultsByKey = {
  [STORAGE_KEYS.users]: initialUsers,
  [STORAGE_KEYS.cars]: initialCars,
  [STORAGE_KEYS.bookings]: [],
  [STORAGE_KEYS.reviews]: [],
  [STORAGE_KEYS.disputes]: [],
  [STORAGE_KEYS.announcements]: [],
};

export function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue === null ? fallback : JSON.parse(storedValue);
  } catch (error) {
    console.error(`Could not read localStorage key "${key}".`, error);
    return fallback;
  }
}

export function writeStorage(key, value) {
  if (typeof window === "undefined") {
    return { ok: false, error: "Browser storage is unavailable." };
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    // The browser's "storage" event does not fire in the tab that wrote the
    // value. Dispatch a same-tab event so active views can refresh as well.
    window.dispatchEvent(new CustomEvent("sw-storage", { detail: { key } }));
    return { ok: true };
  } catch (error) {
    console.error(`Could not write localStorage key "${key}".`, error);
    return {
      ok: false,
      error: "Could not save your changes in this browser.",
    };
  }
}

/** Seed absent keys and add newly introduced seed accounts without overwriting existing records. */
export function initializeDemoData() {
  if (typeof window === "undefined") {
    return { ok: false, error: "Account data can only be initialized in the browser." };
  }

  try {
    for (const [key, defaultValue] of Object.entries(defaultsByKey)) {
      const existingValue = window.localStorage.getItem(key);

      if (existingValue === null) {
        const result = writeStorage(key, defaultValue);
        if (!result.ok) return result;
        continue;
      }

      // Migrate newly added seed users into older demo storage, preserving user edits.
      if (key === STORAGE_KEYS.users) {
        const storedUsers = JSON.parse(existingValue);
        if (Array.isArray(storedUsers)) {
          const removedSeedIds = new Set(["renter-2", "owner-2", "owner-3"]);
          const mergedUsers = storedUsers.filter((user) => !removedSeedIds.has(user.id));
          let changed = mergedUsers.length !== storedUsers.length;

          for (const seedUser of initialUsers) {
            const existingIndex = mergedUsers.findIndex((user) => user.id === seedUser.id);

            if (existingIndex >= 0) {
              const existingUser = mergedUsers[existingIndex];
              const legacyEmailById = {
                "renter-1": "renter@sheggarwheels.com",
                "owner-1": "owner@sheggarwheels.com",
              };
              const previousSeedNames = {
                "renter-1": ["Demo Renter", "Demo Renter One"],
                "owner-1": ["Demo Owner", "Demo Owner One"],
                "admin-1": ["Demo Admin", "Demo Administrator"],
              };

              let updatedUser = existingUser;
              if (
                legacyEmailById[seedUser.id] &&
                existingUser.email?.toLowerCase() === legacyEmailById[seedUser.id]
              ) {
                updatedUser = { ...updatedUser, email: seedUser.email };
              }
              if (previousSeedNames[seedUser.id]?.includes(existingUser.name)) {
                updatedUser = { ...updatedUser, name: seedUser.name };
              }
              if (seedUser.id === "owner-1") {
                const ownerRoles = Array.isArray(updatedUser.roles) ? updatedUser.roles : [];
                const mergedRoles = [...new Set([...ownerRoles, "owner", "renter"])];
                if (mergedRoles.length !== ownerRoles.length || mergedRoles.some((role, index) => role !== ownerRoles[index])) {
                  updatedUser = { ...updatedUser, roles: mergedRoles };
                }
              }
              if (updatedUser !== existingUser) {
                mergedUsers[existingIndex] = updatedUser;
                changed = true;
              }
              continue;
            }

            const emailAlreadyUsed = mergedUsers.some(
              (user) => user.email?.toLowerCase() === seedUser.email.toLowerCase()
            );

            if (!emailAlreadyUsed) {
              mergedUsers.push(seedUser);
              changed = true;
            }
          }

          if (changed) {
            const result = writeStorage(key, mergedUsers);
            if (!result.ok) return result;
          }
        }
      }

      // Consolidate cars from the retired seeded demo owners under Owner One.
      if (key === STORAGE_KEYS.cars) {
        const storedCars = JSON.parse(existingValue);
        if (Array.isArray(storedCars)) {
          let changed = false;
          const consolidatedCars = storedCars.map((car) => {
            if (["owner-2", "owner-3"].includes(car.ownerId)) {
              changed = true;
              return { ...car, ownerId: "owner-1" };
            }
            return car;
          });
          if (changed) {
            const result = writeStorage(key, consolidatedCars);
            if (!result.ok) return result;
          }
        }
      }

      // Preserve old demo-owner booking history after consolidating to Owner One.
      if (key === STORAGE_KEYS.bookings) {
        const storedBookings = JSON.parse(existingValue);
        if (Array.isArray(storedBookings)) {
          let changed = false;
          const consolidatedBookings = storedBookings.map((booking) => {
            if (["owner-2", "owner-3"].includes(booking.ownerId) || booking.renterId === "renter-2") {
              changed = true;
              return {
                ...booking,
                ...(["owner-2", "owner-3"].includes(booking.ownerId) ? { ownerId: "owner-1" } : {}),
                ...(booking.renterId === "renter-2" ? { renterId: "renter-1" } : {}),
              };
            }
            return booking;
          });
          if (changed) {
            const result = writeStorage(key, consolidatedBookings);
            if (!result.ok) return result;
          }
        }
      }
    }

    return { ok: true };
  } catch (error) {
    console.error("Could not initialize account data.", error);
    return {
      ok: false,
      error: "Could not initialize account data in this browser.",
    };
  }
}

function readArray(key, fallback) {
  const value = readStorage(key, fallback);
  return Array.isArray(value) ? value : fallback;
}

export function getCars() {
  return readArray(STORAGE_KEYS.cars, initialCars);
}

export function getUsers() {
  return readArray(STORAGE_KEYS.users, initialUsers);
}

export function getBookings() {
  return readArray(STORAGE_KEYS.bookings, []);
}
