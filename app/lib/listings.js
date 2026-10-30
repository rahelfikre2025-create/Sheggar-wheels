import { getCars, getUsers, STORAGE_KEYS, writeStorage } from "@/app/lib/storage";
import { getCurrentSession, hasRole } from "@/app/lib/session";

/** Admin-only moderation action. Re-reads the session and listing on every call. */
export function approveCarListing(carId) {
  const admin = getCurrentSession();
  if (!admin || admin.status !== "active" || !hasRole(admin, "admin")) {
    return { ok: false, error: "An active administrator must approve listings." };
  }

  const cars = getCars();
  const listing = cars.find((car) => car.id === carId);
  if (!listing) return { ok: false, error: "This listing could not be found." };
  if (listing.status !== "pending") {
    return { ok: false, error: "This listing is no longer waiting for approval." };
  }

  const owner = getUsers().find((user) => user.id === listing.ownerId);
  if (!owner || owner.status !== "active" || !hasRole(owner, "owner")) {
    return { ok: false, error: "The listing owner is not an active owner account." };
  }

  const updatedListing = {
    ...listing,
    status: "approved",
    reviewedAt: new Date().toISOString(),
    reviewedBy: admin.id,
    updatedAt: new Date().toISOString(),
  };
  const result = writeStorage(
    STORAGE_KEYS.cars,
    cars.map((car) => car.id === listing.id ? updatedListing : car)
  );
  return result.ok ? { ok: true, car: updatedListing } : result;
}

/** Admin-only rejection action for a listing that is still pending review. */
export function rejectCarListing(carId, reason) {
  const admin = getCurrentSession();
  if (!admin || admin.status !== "active" || !hasRole(admin, "admin")) {
    return { ok: false, error: "An active administrator must reject listings." };
  }

  const note = String(reason ?? "").trim();
  if (note.length < 3 || note.length > 500) {
    return { ok: false, error: "Add a rejection reason between 3 and 500 characters." };
  }

  const cars = getCars();
  const listing = cars.find((car) => car.id === carId);
  if (!listing) return { ok: false, error: "This listing could not be found." };
  if (listing.status !== "pending") {
    return { ok: false, error: "This listing is no longer waiting for review." };
  }

  const rejectedAt = new Date().toISOString();
  const updatedListing = {
    ...listing,
    status: "rejected",
    rejectionReason: note,
    reviewedAt: rejectedAt,
    reviewedBy: admin.id,
    updatedAt: rejectedAt,
  };
  const result = writeStorage(
    STORAGE_KEYS.cars,
    cars.map((car) => car.id === listing.id ? updatedListing : car)
  );
  return result.ok ? { ok: true, car: updatedListing } : result;
}
