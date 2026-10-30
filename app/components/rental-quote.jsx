"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { SESSION_KEYS } from "@/app/lib/storage";
import { getCurrentSession } from "@/app/lib/session";
import { formatPrice } from "@/app/lib/data/cars";
import { createBooking } from "@/app/lib/bookings";

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addOneDay(date) {
  const nextDay = new Date(`${date}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  return nextDay.toISOString().slice(0, 10);
}

function getRentalDays(pickup, returnDate) {
  const pickupTime = Date.parse(`${pickup}T00:00:00.000Z`);
  const returnTime = Date.parse(`${returnDate}T00:00:00.000Z`);

  return Math.round((returnTime - pickupTime) / 86_400_000);
}

function subscribeToDateChange(onChange) {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);

  const timeout = window.setTimeout(
    onChange,
    tomorrow.getTime() - Date.now()
  );

  return () => window.clearTimeout(timeout);
}

function getTodaySnapshot() {
  return formatLocalDate(new Date());
}

export default function RentalQuote({ car }) {
  const router = useRouter();
  const today = useSyncExternalStore(
    subscribeToDateChange,
    getTodaySnapshot,
    () => ""
  );

  const [pickup, setPickup] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [message, setMessage] = useState("");
  const [requestSent, setRequestSent] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const draft = window.sessionStorage.getItem(SESSION_KEYS.checkoutDraft);
      const savedDates = draft ? JSON.parse(draft) : null;
      if (savedDates?.carId === car?.id) {
        setPickup(savedDates.pickup || "");
        setReturnDate(savedDates.returnDate || "");
      }
    } catch {
      // Keep the date fields empty if this browser cannot read the saved draft.
    }
  }, [car?.id]);

  const pickupIsPast = Boolean(pickup && today && pickup < today);
  const returnIsInvalid = Boolean(
    pickup && returnDate && returnDate <= pickup
  );

  const isValid = Boolean(
    car?.id &&
      pickup &&
      returnDate &&
      !pickupIsPast &&
      !returnIsInvalid
  );

  const rentalDays = isValid ? getRentalDays(pickup, returnDate) : 0;
  const subtotal = rentalDays * (car?.pricePerDay ?? 0);

  function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!isValid) {
      setMessage("Choose valid dates. Return date must be after pick-up.");
      return;
    }

    if (typeof window === "undefined") return;

    const user = getCurrentSession();
    if (!user) {
      try {
        window.sessionStorage.setItem(SESSION_KEYS.checkoutDraft, JSON.stringify({
          carId: car.id,
          pickup,
          returnDate,
        }));
      } catch {
        setMessage("Could not save your selected dates. Please try again after signing in.");
        return;
      }

      const returnToCar = `/cars/${encodeURIComponent(car.id)}#rental-dates`;
      router.push(`/signin?next=${encodeURIComponent(returnToCar)}`);
      return;
    }

    setSubmitting(true);
    const result = createBooking({ carId: car.id, pickup, returnDate });
    setSubmitting(false);
    if (!result.ok) {
      setMessage(result.error || "Your request could not be sent. Please try again.");
      return;
    }

    try {
      window.sessionStorage.removeItem(SESSION_KEYS.checkoutDraft);
    } catch {
      // Removing the draft is optional; the booking has already been saved.
    }
    setRequestSent(result.booking);
  }

  function handleDateChange(setDate, value) {
    setDate(value);
    setMessage("");
    setRequestSent(null);
  }

  return (
    <section
      className="rental-quote"
      id="rental-dates"
      aria-labelledby="rental-dates-heading"
    >
      <h2 id="rental-dates-heading">Choose your dates</h2>

      <form onSubmit={handleSubmit}>
        <div className="rental-date-fields">
          <div className="rental-date-field">
            <label htmlFor="rental-pickup">Pick-up date</label>
            <input
              id="rental-pickup"
              name="pickup"
              type="date"
              min={today || undefined}
              value={pickup}
              aria-invalid={pickupIsPast}
              aria-describedby={pickupIsPast ? "pickup-error" : undefined}
              onChange={(event) =>
                handleDateChange(setPickup, event.target.value)
              }
              required
            />
            {pickupIsPast && (
              <span className="date-error" id="pickup-error">
                Choose today or a future date.
              </span>
            )}
          </div>

          <div className="rental-date-field">
            <label htmlFor="rental-return">Return date</label>
            <input
              id="rental-return"
              name="returnDate"
              type="date"
              min={pickup ? addOneDay(pickup) : today || undefined}
              value={returnDate}
              aria-invalid={returnIsInvalid}
              aria-describedby={returnIsInvalid ? "return-error" : undefined}
              onChange={(event) =>
                handleDateChange(setReturnDate, event.target.value)
              }
              required
            />
            {returnIsInvalid && (
              <span className="date-error" id="return-error">
                Return must be after pick-up.
              </span>
            )}
          </div>
        </div>

        <div className="price-breakdown" aria-live="polite">
          <div>
            <span>Daily rate</span>
            <strong>
              {formatPrice(car?.pricePerDay ?? 0)} <small>/ day</small>
            </strong>
          </div>

          {isValid ? (
            <>
              <div>
                <span>Rental duration</span>
                <strong>
                  {rentalDays} {rentalDays === 1 ? "day" : "days"}
                </strong>
              </div>
              <div className="rental-total">
                <span>Estimated total</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
            </>
          ) : (
            <p className="date-hint">
              Select a pick-up date and a later return date to see your total.
            </p>
          )}
        </div>

        {message && (
          <p
            role="alert"
            style={{
              margin: "12px 0",
              color: "#a1372a",
              fontSize: "12px",
              lineHeight: 1.6,
            }}
          >
            {message}
          </p>
        )}

        {requestSent && (
          <div className="request-info rental-request-success" role="status" aria-live="polite">
            <strong>Your booking request was sent successfully.</strong>
            <p>Wait for the car owner to confirm your request. You can continue to checkout after the owner approves it.</p>
            <Link className="text-link" href={`/bookings/${requestSent.id}`}>View your booking status <span aria-hidden="true">↗</span></Link>
          </div>
        )}

        <button
          className="button button-primary booking-button"
          type="submit"
          disabled={!isValid || submitting || Boolean(requestSent)}
        >
          {submitting ? "Sending request…" : requestSent ? "Request sent" : isValid ? "Request booking" : "Choose dates to continue"}
          <span aria-hidden="true">↗</span>
        </button>
      </form>

      <p className="booking-disclaimer">
        No payment is collected when you send a request. Checkout becomes available after owner approval.
      </p>
    </section>
  );
}
