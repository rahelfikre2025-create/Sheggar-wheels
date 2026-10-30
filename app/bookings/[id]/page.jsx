"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import LeafletMap from "@/app/components/leaflet-map";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import {
  getBookings,
  getCars,
  initializeDemoData,
} from "@/app/lib/storage";
import { formatPrice } from "@/app/lib/data/cars";
import { transitionBooking } from "@/app/lib/bookings";
import { createDispute, createReview, getDisputes, getReviews } from "@/app/lib/milestones";

const simulatedRoute = [
  [9.012, 38.757], [9.018, 38.765], [9.025, 38.773],
  [9.031, 38.781], [9.037, 38.790], [9.043, 38.799],
];

function formatDate(dateString) {
  if (!dateString) return "Date unavailable";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function BookingDetailContent() {
  const params = useParams();
  const bookingId = params.id;

  const [state, setState] = useState({
    loading: true,
    signedIn: false,
    booking: null,
    car: null,
    review: null,
    dispute: null,
    error: "",
  });

  useEffect(() => {
    const initResult = initializeDemoData();

    if (!initResult.ok) {
      setState({
        loading: false,
        signedIn: false,
        booking: null, car: null, review: null, dispute: null,
        error: initResult.error,
      });
      return;
    }

    const user = getCurrentSession();

    if (!user) {
      setState({
        loading: false,
        signedIn: false,
        booking: null, car: null, review: null, dispute: null,
        error: "",
      });
      return;
    }

    if (!hasRole(user, "renter")) {
      setState({
        loading: false,
        signedIn: true,
        booking: null, car: null, review: null, dispute: null,
        error: "This booking is unavailable.",
      });
      return;
    }

    const booking = getBookings().find(
      (item) => item.id === bookingId && item.renterId === user.id
    );

    // Do not reveal whether another renter's booking exists.
    if (!booking) {
      setState({
        loading: false,
        signedIn: true,
        booking: null, car: null, review: null, dispute: null,
        error: "This booking is unavailable or does not belong to your account.",
      });
      return;
    }

    const car = getCars().find((item) => item.id === booking.carId) ?? null;

    setState({
      loading: false,
      signedIn: true,
      booking,
      car,
      review: getReviews().find((item) => item.bookingId === booking.id) ?? null,
      dispute: getDisputes().find((item) => item.bookingId === booking.id) ?? null,
      error: "",
    });

    const refreshBooking = () => {
      const currentUser = getCurrentSession();
      if (!currentUser || currentUser.id !== user.id || !hasRole(currentUser, "renter")) return;
      const updatedBooking = getBookings().find((item) => item.id === bookingId && item.renterId === currentUser.id);
      if (!updatedBooking) return;
      setState((current) => ({
        ...current,
        booking: updatedBooking,
        car: getCars().find((item) => item.id === updatedBooking.carId) ?? null,
        review: getReviews().find((item) => item.bookingId === updatedBooking.id) ?? null,
        dispute: getDisputes().find((item) => item.bookingId === updatedBooking.id) ?? null,
      }));
    };
    window.addEventListener("storage", refreshBooking);
    window.addEventListener("sw-storage", refreshBooking);
    window.addEventListener("focus", refreshBooking);
    const refreshTimer = window.setInterval(refreshBooking, 2000);
    return () => {
      window.removeEventListener("storage", refreshBooking);
      window.removeEventListener("sw-storage", refreshBooking);
      window.removeEventListener("focus", refreshBooking);
      window.clearInterval(refreshTimer);
    };
  }, [bookingId]);

  const [feedback, setFeedback] = useState("");
  const [tripStep, setTripStep] = useState(0);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  function handlePaymentReference(event) {
    event.preventDefault();
    setPaymentBusy(true);
    const paymentReference = new FormData(event.currentTarget).get("paymentReference");
    const result = transitionBooking({ bookingId, nextStatus: "payment_submitted", paymentReference });
    setFeedback(result.ok ? "Demo payment reference submitted. The owner must verify it before the rental is confirmed." : result.error);
    if (result.ok) setState((current) => ({ ...current, booking: result.booking }));
    setPaymentBusy(false);
  }

  function handleReview(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = createReview({ bookingId, rating: form.get("rating"), comment: form.get("comment") });
    setFeedback(result.ok ? "Your review was saved." : result.error);
    if (result.ok) setState((current) => ({ ...current, review: result.review }));
  }

  function handleDispute(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = createDispute({ bookingId, reason: form.get("reason") });
    setFeedback(result.ok ? "Your issue was sent to the administrator." : result.error);
    if (result.ok) setState((current) => ({ ...current, dispute: result.dispute, booking: { ...current.booking, status: "disputed" } }));
  }

  const signInPath = `/signin?next=${encodeURIComponent(
    `/bookings/${bookingId}`
  )}`;

  return (
    <>
      <SiteHeader />

      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          <Link className="back-link" href="/bookings">
            <span aria-hidden="true">←</span> Back to my bookings
          </Link>

          {state.loading ? (
            <p className="catalogue-loading" role="status">
              Loading booking…
            </p>
          ) : !state.signedIn ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">↗</span>
              <h1>Sign in to view this booking.</h1>
              <p>Only the renter who created a booking can see its details.</p>
              <Link className="button button-primary" href={signInPath}>
                Continue to sign in <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : state.error ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">!</span>
              <h1>Booking unavailable</h1>
              <p>{state.error}</p>
              <Link className="button button-primary" href="/bookings">
                Back to my bookings <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="catalogue-title">
                <div>
                  <span className="eyebrow">BOOKING DETAILS</span>
                  <h1>{state.car
                    ? `${state.car.year} ${state.car.make} ${state.car.model}`
                    : "Your car booking"}
                  </h1>
                  <p>Review the dates, price, and current request status.</p>
                </div>

                <span className="catalogue-demo-tag">
                  <span aria-hidden="true" />
                  BOOKING DETAILS
                </span>
              </div>

              <section className="details-panel" aria-labelledby="booking-summary">
                <h2 id="booking-summary">Booking summary</h2>

                <dl className="details-specs">
                  <div>
                    <dt>Status</dt>
                    <dd>{formatStatus(state.booking.status)}</dd>
                  </div>
                  <div>
                    <dt>Pick-up</dt>
                    <dd>{formatDate(state.booking.startDate)}</dd>
                  </div>
                  <div>
                    <dt>Return</dt>
                    <dd>{formatDate(state.booking.endDate)}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>
                      {state.booking.days}{" "}
                      {state.booking.days === 1 ? "day" : "days"}
                    </dd>
                  </div>
                  <div>
                    <dt>Daily rate at request</dt>
                    <dd>{formatPrice(state.booking.pricePerDay ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{formatPrice(state.booking.subtotal ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Service fee</dt>
                    <dd>{formatPrice(state.booking.fee ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>{formatPrice(state.booking.total ?? 0)}</dd>
                  </div>
                  <div><dt>Payment</dt><dd>{state.booking.paymentStatus === "mock_confirmed" ? "Simulated payment confirmed" : state.booking.paymentStatus === "reference_submitted" ? "Reference submitted · awaiting owner verification" : state.booking.paymentStatus === "awaiting_renter_payment" ? "Waiting for renter" : "Not collected"}</dd></div>
                  {state.booking.paymentReference && <div>
                    <dt>Demo transaction reference</dt>
                    <dd>{state.booking.paymentReference}</dd>
                  </div>}
                </dl>

                <p className="demo-note" style={{ marginTop: "20px" }}>
                  Booking ID: {state.booking.id}
                </p>

                <p className="booking-disclaimer">
                  {state.booking.paymentStatus === "mock_confirmed" ? "The owner confirmed the simulated payment. No money moved through this website." : "Payment actions are simulated. Do not enter a PIN, password, card number, or other secret."}
                </p>
              </section>

              {feedback && <p role="status" className="request-info">{feedback}</p>}

              {state.booking.status === "approved" && !state.booking.paymentInstructions && <section className="details-panel milestone-panel" role="status"><span className="eyebrow">REQUEST APPROVED</span><h2>Waiting for owner payment instructions</h2><p>The owner approved your booking. Checkout will become available here as soon as they share the simulated payment instructions.</p></section>}

              {state.booking.paymentInstructions && ["approved", "payment_submitted", "confirmed", "in_progress", "completed"].includes(state.booking.status) && <section className="details-panel milestone-panel"><span className="eyebrow">OWNER PAYMENT INSTRUCTIONS · SIMULATION ONLY</span><h2>{state.booking.paymentInstructions.method === "telebirr" ? "Demo TeleBirr" : "Bank transfer"}</h2><p className="payment-instruction-copy">{state.booking.paymentInstructions.details}</p><p>Booking total: <strong>{formatPrice(state.booking.total ?? 0)}</strong></p><p className="booking-disclaimer">Do not enter a PIN, password, card number, or other secret. The site does not process payments.</p>{state.booking.status === "approved" && !checkoutOpen && <button className="button button-primary" type="button" onClick={() => setCheckoutOpen(true)}>Continue to checkout <span aria-hidden="true">↗</span></button>}{state.booking.status === "approved" && checkoutOpen && <><h3>Submit a demo payment reference</h3><p>This only records a reference for the owner to verify. No payment is processed here.</p><form className="milestone-form" onSubmit={handlePaymentReference}><label>Demo payment reference<input name="paymentReference" minLength={4} maxLength={80} required placeholder="Enter the reference you received" /></label><button className="button button-primary" type="submit" disabled={paymentBusy}>{paymentBusy ? "Submitting…" : "Submit simulated payment reference"}</button></form></>}</section>}
              {state.booking.status === "payment_submitted" && <section className="details-panel milestone-panel"><span className="eyebrow">AWAITING OWNER VERIFICATION</span><h2>Reference submitted</h2><p>Your demo reference <strong>{state.booking.paymentReference}</strong> has been sent to the owner. The rental is not confirmed yet.</p></section>}

              {state.booking.status === "completed" && !state.review && (
                <section className="details-panel milestone-panel" aria-labelledby="review-heading">
                  <h2 id="review-heading">How was your trip?</h2>
                  <p>Leave a review for the owner after your completed booking.</p>
                  <form onSubmit={handleReview} className="milestone-form">
                    <label>Rating
                      <select name="rating" defaultValue="5" required>
                        {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>)}
                      </select>
                    </label>
                    <label>Your review
                      <textarea name="comment" minLength={3} maxLength={1000} required rows={4} placeholder="Share a few details about the trip" />
                    </label>
                    <button className="button button-primary" type="submit">Submit review</button>
                  </form>
                </section>
              )}
              {state.review && (
                <section className="details-panel milestone-panel">
                  <h2>Your review · {"★".repeat(state.review.rating)}</h2>
                  <p>{state.review.comment}</p>
                  {state.review.ownerReply ? <div className="request-info"><span>Owner reply</span><p>{state.review.ownerReply}</p></div> : <p className="demo-note">The owner has not replied yet.</p>}
                </section>
              )}

              {state.booking.status === "in_progress" && (
                <section className="details-panel milestone-panel" aria-labelledby="tracking-heading">
                  <span className="eyebrow">TRIP PROGRESS</span>
                  <h2 id="tracking-heading">Trip tracking in Addis Ababa</h2>
                  <p>Illustrative route only. Live GPS tracking is not connected.</p>
                  <div className="trip-map"><LeafletMap className="leaflet-map" center={simulatedRoute[2]} zoom={13} markers={[{ id: "simulated-car", position: simulatedRoute[tripStep], label: "Vehicle location update " + (tripStep + 1), kind: "trip" }]} /></div>
                  <p className="demo-note">Location update {tripStep + 1} of 6.</p>
                  <button className="button button-primary" type="button" onClick={() => setTripStep((step) => (step + 1) % 6)}>Show next update</button>
                </section>
              )}

              {state.booking.status === "in_progress" && !state.dispute && (
                <section className="details-panel milestone-panel" aria-labelledby="issue-heading">
                  <h2 id="issue-heading">Need help with this trip?</h2>
                  <form onSubmit={handleDispute} className="milestone-form">
                    <label>Describe the issue
                      <textarea name="reason" minLength={5} maxLength={1000} rows={3} required placeholder="Tell the administrator what happened" />
                    </label>
                    <button className="button button-dark" type="submit">Report an issue</button>
                  </form>
                </section>
              )}
              {state.dispute && <section className="details-panel milestone-panel"><h2>Issue: {state.dispute.status}</h2><p>{state.dispute.reason}</p>{state.dispute.resolution && <p><strong>Resolution:</strong> {state.dispute.resolution}</p>}</section>}
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

export default function BookingDetailPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader />
          <main className="catalogue-main">
            <section className="page-width catalogue-layout">
              <p className="catalogue-loading" role="status">
                Loading booking…
              </p>
            </section>
          </main>
          <SiteFooter />
        </>
      }
    >
      <BookingDetailContent />
    </Suspense>
  );
}
