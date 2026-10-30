import { getCurrentSession, hasRole } from "@/app/lib/session";
import { getBookings, getCars, STORAGE_KEYS, readStorage, writeStorage } from "@/app/lib/storage";

const fail = (error) => ({ ok: false, error });
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const arrayAt = (key) => {
  const value = readStorage(key, []);
  return Array.isArray(value) ? value : [];
};

function getActor() {
  const actor = getCurrentSession();
  if (!actor) return { error: "Sign in to continue." };
  if (actor.status !== "active") return { error: "This account is suspended." };
  return { actor };
}

function getOwnedBooking(actor, bookingId, role) {
  const booking = getBookings().find((item) => item.id === bookingId);
  if (!booking) return { error: "Booking not found." };
  const car = getCars().find((item) => item.id === booking.carId);
  const allowed = role === "renter"
    ? hasRole(actor, "renter") && booking.renterId === actor.id
    : hasRole(actor, "owner") && car?.ownerId === actor.id && booking.ownerId === actor.id;
  return allowed ? { booking, car } : { error: "You cannot access this booking." };
}

export function getReviews() { return arrayAt(STORAGE_KEYS.reviews); }
export function getDisputes() { return arrayAt(STORAGE_KEYS.disputes); }
export function getAnnouncements() {
  const now = Date.now();
  return arrayAt(STORAGE_KEYS.announcements)
    .filter((item) => item.active !== false)
    .filter((item) => !item.expiresAt || new Date(item.expiresAt).getTime() > now);
}

export function createReview({ bookingId, rating, comment } = {}) {
  const auth = getActor(); if (auth.error) return fail(auth.error);
  const { actor } = auth;
  const access = getOwnedBooking(actor, bookingId, "renter");
  if (access.error) return fail(access.error);
  if (access.booking.status !== "completed") return fail("Reviews are available after the trip is completed.");
  const reviews = getReviews();
  if (reviews.some((item) => item.bookingId === bookingId)) return fail("This booking already has a review.");
  const score = Number(rating);
  const text = String(comment ?? "").trim();
  if (!Number.isInteger(score) || score < 1 || score > 5) return fail("Choose a rating from 1 to 5.");
  if (text.length < 3 || text.length > 1000) return fail("Write a review between 3 and 1,000 characters.");
  const review = { id: makeId("review"), bookingId, carId: access.booking.carId, renterId: actor.id, ownerId: access.car.ownerId, rating: score, comment: text, createdAt: new Date().toISOString(), ownerReply: "", repliedAt: null };
  const result = writeStorage(STORAGE_KEYS.reviews, [...reviews, review]);
  return result.ok ? { ok: true, review } : fail(result.error);
}

export function replyToReview({ reviewId, reply } = {}) {
  const auth = getActor(); if (auth.error) return fail(auth.error);
  const { actor } = auth;
  if (!hasRole(actor, "owner")) return fail("Only an owner can reply to a review.");
  const reviews = getReviews();
  const review = reviews.find((item) => item.id === reviewId);
  if (!review) return fail("Review not found.");
  const booking = getBookings().find((item) => item.id === review.bookingId);
  if (!booking || booking.status !== "completed" || booking.carId !== review.carId) return fail("This review is not attached to a completed booking.");
  const car = getCars().find((item) => item.id === review.carId);
  if (!car || car.ownerId !== actor.id || review.ownerId !== actor.id) return fail("You do not own this listing.");
  if (review.ownerReply) return fail("A reply has already been added.");
  const text = String(reply ?? "").trim();
  if (text.length < 2 || text.length > 1000) return fail("Reply must be between 2 and 1,000 characters.");
  const updated = { ...review, ownerReply: text, repliedAt: new Date().toISOString() };
  const result = writeStorage(STORAGE_KEYS.reviews, reviews.map((item) => item.id === reviewId ? updated : item));
  return result.ok ? { ok: true, review: updated } : fail(result.error);
}

export function createDispute({ bookingId, reason } = {}) {
  const auth = getActor(); if (auth.error) return fail(auth.error);
  const { actor } = auth;
  const booking = getBookings().find((item) => item.id === bookingId);
  if (!booking) return fail("Booking not found.");
  const car = getCars().find((item) => item.id === booking.carId);
  const isRenter = hasRole(actor, "renter") && actor.id === booking.renterId;
  const isOwner = hasRole(actor, "owner") && actor.id === booking.ownerId && car?.ownerId === actor.id;
  if (!isRenter && !isOwner) return fail("You cannot report an issue for this booking.");
  if (!["approved", "payment_submitted", "confirmed", "in_progress", "completed", "resolved"].includes(booking.status)) return fail("An issue can be reported after a booking has been approved or confirmed.");
  if (getDisputes().some((item) => item.bookingId === bookingId && item.status === "open")) return fail("This booking already has an open issue.");
  const text = String(reason ?? "").trim();
  if (text.length < 5 || text.length > 1000) return fail("Describe the issue in 5 to 1,000 characters.");
  const disputes = getDisputes();
  const bookings = getBookings();
  const dispute = { id: makeId("dispute"), bookingId, carId: booking.carId, renterId: booking.renterId, ownerId: booking.ownerId, openedBy: actor.id, reason: text, status: "open", createdAt: new Date().toISOString(), resolvedAt: null };
  const disputeWrite = writeStorage(STORAGE_KEYS.disputes, [...disputes, dispute]);
  if (!disputeWrite.ok) return fail(disputeWrite.error);
  const bookingWrite = writeStorage(STORAGE_KEYS.bookings, bookings.map((item) => item.id === bookingId ? { ...item, status: "disputed", updatedAt: new Date().toISOString() } : item));
  if (!bookingWrite.ok) {
    writeStorage(STORAGE_KEYS.disputes, disputes);
    return fail(bookingWrite.error);
  }
  return { ok: true, dispute };
}

export function resolveDispute({ disputeId, resolution } = {}) {
  const auth = getActor(); if (auth.error) return fail(auth.error);
  if (!hasRole(auth.actor, "admin")) return fail("Only the administrator can resolve issues.");
  const disputes = getDisputes();
  const dispute = disputes.find((item) => item.id === disputeId);
  if (!dispute || dispute.status !== "open") return fail("Open issue not found.");
  const text = String(resolution ?? "").trim();
  if (text.length < 3 || text.length > 1000) return fail("Add a resolution between 3 and 1,000 characters.");
  const bookings = getBookings();
  const booking = bookings.find((item) => item.id === dispute.bookingId);
  if (!booking || booking.status !== "disputed") return fail("The booking is no longer disputed.");
  const updated = { ...dispute, status: "resolved", resolution: text, resolvedBy: auth.actor.id, resolvedAt: new Date().toISOString() };
  const disputeWrite = writeStorage(STORAGE_KEYS.disputes, disputes.map((item) => item.id === disputeId ? updated : item));
  if (!disputeWrite.ok) return fail(disputeWrite.error);
  const bookingWrite = writeStorage(STORAGE_KEYS.bookings, bookings.map((item) => item.id === booking.id ? { ...item, status: "resolved", updatedAt: new Date().toISOString() } : item));
  if (!bookingWrite.ok) {
    writeStorage(STORAGE_KEYS.disputes, disputes);
    return fail(bookingWrite.error);
  }
  return { ok: true, dispute: updated };
}

export function createAnnouncement({ title, message, durationDays } = {}) {
  const auth = getActor(); if (auth.error) return fail(auth.error);
  if (!hasRole(auth.actor, "admin")) return fail("Only the administrator can publish announcements.");
  const cleanTitle = String(title ?? "").trim();
  const cleanMessage = String(message ?? "").trim();
  const selectedDuration = Number(durationDays);
  if (!Number.isFinite(selectedDuration) || selectedDuration < 1 || selectedDuration > 365) return fail("Choose an announcement duration of at least 1 day.");
  if (cleanTitle.length < 3 || cleanTitle.length > 100 || cleanMessage.length < 3 || cleanMessage.length > 1000) return fail("Enter a title (3–100 characters) and message (3–1,000 characters).");
  const expiresAt = new Date(Date.now() + selectedDuration * 24 * 60 * 60 * 1000).toISOString();
  const announcement = {
    id: makeId("announcement"),
    title: cleanTitle,
    message: cleanMessage,
    active: true,
    durationDays: selectedDuration,
    expiresAt,
    createdAt: new Date().toISOString(),
    createdBy: auth.actor.id,
  };
  const result = writeStorage(STORAGE_KEYS.announcements, [...arrayAt(STORAGE_KEYS.announcements), announcement]);
  return result.ok ? { ok: true, announcement } : fail(result.error);
}

export function exportRowsToCsv(filename, headers, rows) {
  if (typeof window === "undefined" || typeof document === "undefined") return fail("CSV export is only available in the browser.");
  try {
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
  } catch (error) { return fail(error?.message || "Could not export CSV."); }
}

export function getPublicAnnouncements() { return getAnnouncements().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); }
