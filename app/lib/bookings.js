import {
  getBookings,
  getCars,
  getUsers,
  writeStorage,
  STORAGE_KEYS,
} from "@/app/lib/storage";

import {
  getCurrentSession,
  hasRole,
} from "@/app/lib/session";

const ACTIVE_BOOKING_STATUSES = [
  "confirmed",
  "in_progress",
  "disputed",
];

const COMPLETED_PAYMENT_STATUSES = ["mock_confirmed", "mock_paid"];

/** A booking reserves a car only after payment has been verified. */
export function isBookingRentalReserved(booking) {
  return Boolean(
    booking &&
    ACTIVE_BOOKING_STATUSES.includes(booking.status) &&
    COMPLETED_PAYMENT_STATUSES.includes(booking.paymentStatus)
  );
}

const ALLOWED_TRANSITIONS = {
  pending: ["approved", "declined", "cancelled"],
  requested: ["approved", "declined", "cancelled"],
  approved: ["payment_submitted", "cancelled"],
  payment_submitted: ["confirmed"],
  confirmed: ["in_progress", "cancelled", "disputed"],
  in_progress: ["completed", "disputed"],
  completed: ["reviewed"],
  disputed: ["resolved"],
  declined: [],
  cancelled: [],
  reviewed: [],
  resolved: [],
};

/**
 * Convert YYYY-MM-DD into a UTC timestamp.
 * Returns NaN if the date is missing or invalid.
 */
function dateToUtcTime(dateString) {
  if (
    typeof dateString !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    return NaN;
  }

  const timestamp = Date.parse(`${dateString}T00:00:00.000Z`);

  // Reject impossible dates such as 2026-02-31.
  if (new Date(timestamp).toISOString().slice(0, 10) !== dateString) {
    return NaN;
  }

  return timestamp;
}

function getTodayDateString() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isValidDateRange(pickup, returnDate) {
  const pickupTime = dateToUtcTime(pickup);
  const returnTime = dateToUtcTime(returnDate);

  return (
    Number.isFinite(pickupTime) &&
    Number.isFinite(returnTime) &&
    returnTime > pickupTime
  );
}

/**
 * Rental duration is the day difference.
 * For example, pickup on June 1 and return on June 3 is 2 days.
 */
export function calculateDays(pickup, returnDate) {
  if (!isValidDateRange(pickup, returnDate)) {
    return 0;
  }

  const pickupTime = dateToUtcTime(pickup);
  const returnTime = dateToUtcTime(returnDate);

  return (returnTime - pickupTime) / 86_400_000;
}

/**
 * Return the price breakdown.
 * The current rate calculation adds no extra fee, so total equals subtotal.
 */
export function calculatePrice(days, dailyPrice) {
  const validDays = Number(days);
  const validDailyPrice = Number(dailyPrice);

  if (
    !Number.isInteger(validDays) ||
    validDays < 1 ||
    !Number.isFinite(validDailyPrice) ||
    validDailyPrice <= 0
  ) {
    return {
      subtotal: 0,
      fee: 0,
      total: 0,
    };
  }

  const subtotal = validDays * validDailyPrice;
  const fee = 0;

  return {
    subtotal,
    fee,
    total: subtotal + fee,
  };
}

/**
 * Check if two date ranges overlap.
 * Return dates are exclusive: a booking ending June 3 does not overlap
 * another booking starting June 3.
 */
export function datesOverlap(
  firstStart,
  firstEnd,
  secondStart,
  secondEnd
) {
  if (
    !isValidDateRange(firstStart, firstEnd) ||
    !isValidDateRange(secondStart, secondEnd)
  ) {
    return false;
  }

  const firstStartTime = dateToUtcTime(firstStart);
  const firstEndTime = dateToUtcTime(firstEnd);
  const secondStartTime = dateToUtcTime(secondStart);
  const secondEndTime = dateToUtcTime(secondEnd);

  return firstStartTime < secondEndTime && secondStartTime < firstEndTime;
}

/** Whether a paid, confirmed rental occupies a car on a calendar date. */
export function isCarRentedOnDate(carId, dateString, bookings = getBookings()) {
  if (!carId || typeof dateString !== "string") return false;

  return bookings.some((booking) =>
    booking.carId === carId &&
    isBookingRentalReserved(booking) &&
    typeof booking.startDate === "string" &&
    typeof booking.endDate === "string" &&
    dateString >= booking.startDate &&
    dateString < booking.endDate
  );
}

function fail(error) {
  return { ok: false, error };
}

function getActiveOwner(car) {
  return getUsers().find(
    (user) => user.id === car.ownerId && user.status === "active"
  );
}

function hasUnavailableDate(car, pickup, returnDate) {
  if (!Array.isArray(car.unavailableDates)) {
    return false;
  }

  return car.unavailableDates.some((unavailableDate) => {
    // Supports either a single date string or a date-range object.
    if (typeof unavailableDate === "string") {
      return (
        unavailableDate >= pickup &&
        unavailableDate < returnDate
      );
    }

    if (
      unavailableDate &&
      typeof unavailableDate.startDate === "string" &&
      typeof unavailableDate.endDate === "string"
    ) {
      return datesOverlap(
        pickup,
        returnDate,
        unavailableDate.startDate,
        unavailableDate.endDate
      );
    }

    return false;
  });
}

function hasBookingConflict(bookings, carId, pickup, returnDate, ignoreId) {
  return bookings.some((booking) => {
    if (
      booking.id === ignoreId ||
      booking.carId !== carId ||
      !isBookingRentalReserved(booking)
    ) {
      return false;
    }

    return datesOverlap(
      pickup,
      returnDate,
      booking.startDate,
      booking.endDate
    );
  });
}

/**
 * Check whether the current signed-in renter can request this car and date range.
 *
 * Expected input:
 * {
 *   carId: "car-id",
 *   pickup: "2026-11-01",
 *   returnDate: "2026-11-03"
 * }
 */
export function validateBookingRequest({
  carId,
  pickup,
  returnDate,
} = {}) {
  const user = getCurrentSession();

  if (!user) {
    return fail("Not signed in. Please sign in before requesting a booking.");
  }

  if (user.status !== "active") {
    return fail("This account is suspended.");
  }

  if (!hasRole(user, "renter")) {
    return fail("This account does not have renter access.");
  }

  if (!isValidDateRange(pickup, returnDate)) {
    return fail("Choose valid dates. Return date must be after pick-up.");
  }

  if (pickup < getTodayDateString()) {
    return fail("Pick-up date cannot be in the past.");
  }

  const car = getCars().find((item) => item.id === carId);

  if (!car) {
    return fail("This car could not be found.");
  }

  if (car.status !== "approved") {
    return fail("This car is not available for public booking.");
  }

  if (!car.ownerId) {
    return fail("This car does not have an owner assigned yet.");
  }

  if (!getActiveOwner(car)) {
    return fail("This car's owner is not available.");
  }

  if (hasUnavailableDate(car, pickup, returnDate)) {
    return fail("The car is unavailable for some of those dates.");
  }

  const bookings = getBookings();

  if (hasBookingConflict(bookings, car.id, pickup, returnDate)) {
    return fail("The car already has a booking during those dates.");
  }

  const days = calculateDays(pickup, returnDate);
  const price = calculatePrice(days, car.pricePerDay);

  return {
    ok: true,
    user,
    car,
    days,
    price,
  };
}

/**
 * Create and save a renter booking request.
 * The saved booking snapshots the daily rate and price breakdown.
 */
export function createBooking({ carId, pickup, returnDate } = {}) {
  // Validate again here so callers cannot bypass the checks in the UI.
  const validation = validateBookingRequest({
    carId,
    pickup,
    returnDate,
  });

  if (!validation.ok) {
    return validation;
  }

  const { user, car, days, price } = validation;

  // Re-read records immediately before writing to avoid using an old list.
  const latestCars = getCars();
  const latestCar = latestCars.find((item) => item.id === carId);
  const latestBookings = getBookings();
  const latestUser = getUsers().find((item) => item.id === user.id);

  if (!latestUser || latestUser.status !== "active") {
    return fail("Your account is no longer active.");
  }

  if (
    !latestCar ||
    latestCar.ownerId !== car.ownerId ||
    latestCar.status !== "approved"
  ) {
    return fail("This car is no longer available for booking.");
  }

  if (hasUnavailableDate(latestCar, pickup, returnDate)) {
    return fail("The car is unavailable for some of those dates.");
  }

  if (hasBookingConflict(latestBookings, carId, pickup, returnDate)) {
    return fail("The car already has a booking during those dates.");
  }

  const now = new Date().toISOString();
  const booking = {
    id: makeId(),
    carId: latestCar.id,
    renterId: latestUser.id,
    ownerId: latestCar.ownerId,
    startDate: pickup,
    endDate: returnDate,
    days,
    pricePerDay: latestCar.pricePerDay,
    subtotal: price.subtotal,
    fee: price.fee,
    total: price.total,
    paymentStatus: "not_requested",
    paymentProvider: null,
    paymentInstructions: null,
    paymentReference: null,
    paymentSubmittedAt: null,
    paymentConfirmedAt: null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const result = writeStorage(STORAGE_KEYS.bookings, [
    ...latestBookings,
    booking,
  ]);

  if (!result.ok) {
    return fail(result.error || "Could not save the booking.");
  }

  return { ok: true, booking };
}

/**
 * Apply an allowed status change after checking role, ownership, booking state,
 * date validity, availability, and conflicts.
 *
 * Supported examples:
 * - Owner: pending -> approved / declined; approval includes instructions
 * - Renter: approved -> payment_submitted with a demo reference
 * - Owner: payment_submitted -> confirmed
 * - Renter: pending or approved -> cancelled
 * - Owner: confirmed -> in_progress -> completed
 * - Renter or owner: in_progress -> disputed
 * - Admin: disputed -> resolved
 */
export function transitionBooking({ bookingId, nextStatus, paymentReference } = {}) {
  const actor = getCurrentSession();

  if (!actor) {
    return fail("Not signed in.");
  }

  if (actor.status !== "active") {
    return fail("This account is suspended.");
  }

  if (!bookingId || !nextStatus) {
    return fail("Booking and new status are required.");
  }

  // Re-read immediately before checking and writing.
  const bookings = getBookings();
  const booking = bookings.find((item) => item.id === bookingId);

  if (!booking) {
    return fail("Booking could not be found.");
  }

  if (!ALLOWED_TRANSITIONS[booking.status]?.includes(nextStatus)) {
    return fail(
      `Cannot change a booking from "${booking.status}" to "${nextStatus}".`
    );
  }

  const car = getCars().find((item) => item.id === booking.carId);

  if (!car) {
    return fail("The car for this booking could not be found.");
  }

  if (
    !isValidDateRange(booking.startDate, booking.endDate) ||
    !Number.isInteger(booking.days) ||
    booking.days !== calculateDays(booking.startDate, booking.endDate)
  ) {
    return fail("This booking has invalid dates.");
  }

  const actorIsRenter = booking.renterId === actor.id;
  const actorIsOwner =
    booking.ownerId === actor.id && car.ownerId === actor.id;
  const actorIsAdmin = hasRole(actor, "admin");

  if (["approved", "declined", "confirmed"].includes(nextStatus)) {
    if (!actorIsOwner || !hasRole(actor, "owner")) {
      return fail("Only this car's owner can update its booking request or payment.");
    }
  } else if (nextStatus === "payment_submitted") {
    if (!actorIsRenter || !hasRole(actor, "renter")) return fail("Only the renter can submit their payment reference.");
    if (typeof paymentReference !== "string" || paymentReference.trim().length < 4 || paymentReference.trim().length > 80) {
      return fail("Enter a demo payment reference between 4 and 80 characters.");
    }
  } else if (nextStatus === "cancelled") {
    if (!actorIsRenter || !hasRole(actor, "renter")) {
      return fail("You can cancel only your own booking.");
    }
  } else if (nextStatus === "in_progress" || nextStatus === "completed") {
    if (!actorIsOwner || !hasRole(actor, "owner")) {
      return fail("Only this car's owner can update the rental status.");
    }
  } else if (nextStatus === "disputed") {
    if (
      !(actorIsRenter || actorIsOwner) ||
      !(hasRole(actor, "renter") || hasRole(actor, "owner"))
    ) {
      return fail("Only the renter or owner can raise an issue.");
    }
  } else if (nextStatus === "resolved") {
    if (!actorIsAdmin) {
      return fail("Only the administrator can resolve a dispute.");
    }
  } else if (nextStatus === "reviewed") {
    if (!actorIsRenter || !hasRole(actor, "renter")) {
      return fail("Only the renter can mark their booking as reviewed.");
    }
  }

  // Approval always checks date conflicts again, not just when the request
  // was first created.
  if (nextStatus === "approved") {
    if (car.status !== "approved" || !getActiveOwner(car)) {
      return fail("This car is no longer available for approval.");
    }

    if (hasUnavailableDate(car, booking.startDate, booking.endDate)) {
      return fail("The car is unavailable for some of those dates.");
    }

    if (
      hasBookingConflict(
        bookings,
        booking.carId,
        booking.startDate,
        booking.endDate,
        booking.id
      )
    ) {
      return fail("Another active booking now overlaps these dates.");
    }
  }

  if (nextStatus === "confirmed" && booking.status !== "payment_submitted") {
    return fail("The renter must submit a demo payment reference before you confirm payment.");
  }

  if (nextStatus === "confirmed") {
    if (hasUnavailableDate(car, booking.startDate, booking.endDate)) {
      return fail("The car is no longer available for some of those dates.");
    }
    if (hasBookingConflict(bookings, booking.carId, booking.startDate, booking.endDate, booking.id)) {
      return fail("Another renter already has a confirmed rental for some of those dates.");
    }
  }

  if (nextStatus === "payment_submitted" && booking.status !== "approved") {
    return fail("Payment can be submitted only after the owner approves the booking.");
  }

  if (nextStatus === "approved" && !["pending", "requested"].includes(booking.status)) {
    return fail("Only pending booking requests can be approved.");
  }

  const releasesMockPayment =
    ["cancelled", "declined"].includes(nextStatus) &&
    booking.paymentStatus === "mock_paid";
  const updatedBooking = {
    ...booking,
    status: nextStatus,
    ...(nextStatus === "approved" ? { paymentStatus: "awaiting_owner_instructions" } : {}),
    ...(nextStatus === "payment_submitted" ? {
      paymentReference: paymentReference.trim(),
      paymentSubmittedAt: new Date().toISOString(),
      paymentStatus: "reference_submitted",
    } : {}),
    ...(nextStatus === "confirmed" ? {
      paymentConfirmedAt: new Date().toISOString(),
      paymentStatus: "mock_confirmed",
    } : {}),
    ...(releasesMockPayment
      ? { paymentStatus: "mock_refunded", paymentUpdatedAt: new Date().toISOString() }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  const updatedBookings = bookings.map((item) =>
    item.id === booking.id ? updatedBooking : item
  );

  const result = writeStorage(STORAGE_KEYS.bookings, updatedBookings);

  if (!result.ok) {
    return fail(result.error || "Could not update the booking.");
  }

  return { ok: true, booking: updatedBooking };
}

/** Save owner instructions only after approval and before renter payment submission. */
export function setBookingPaymentInstructions({ bookingId, paymentInstructions } = {}) {
  const actor = getCurrentSession();
  if (!actor) return fail("Not signed in.");
  if (actor.status !== "active") return fail("This account is suspended.");
  if (!hasRole(actor, "owner")) return fail("Only an owner can provide payment instructions.");

  const bookings = getBookings();
  const booking = bookings.find((item) => item.id === bookingId);
  if (!booking) return fail("Booking could not be found.");
  const car = getCars().find((item) => item.id === booking.carId);
  if (!car || car.ownerId !== actor.id || booking.ownerId !== actor.id) {
    return fail("You can provide instructions only for your own car booking.");
  }
  if (booking.status !== "approved") return fail("Payment instructions can be added only after approval.");
  if (booking.paymentInstructions) return fail("Payment instructions have already been saved for this booking.");

  const method = paymentInstructions?.method;
  const details = typeof paymentInstructions?.details === "string" ? paymentInstructions.details.trim() : "";
  if (!["telebirr", "bank_transfer"].includes(method) || details.length < 3 || details.length > 500) {
    return fail("Choose a payment method and enter instructions between 3 and 500 characters.");
  }

  const updatedBooking = {
    ...booking,
    paymentInstructions: { method, details, updatedAt: new Date().toISOString(), updatedBy: actor.id },
    paymentStatus: "awaiting_renter_payment",
    updatedAt: new Date().toISOString(),
  };
  const result = writeStorage(STORAGE_KEYS.bookings, bookings.map((item) => item.id === booking.id ? updatedBooking : item));
  if (!result.ok) return fail(result.error || "Could not save payment instructions.");
  return { ok: true, booking: updatedBooking };
}

function makeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `booking-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
