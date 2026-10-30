"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import { setBookingPaymentInstructions, transitionBooking } from "@/app/lib/bookings";
import {
  getBookings,
  getCars,
  initializeDemoData,
} from "@/app/lib/storage";
import { formatPrice } from "@/app/lib/data/cars";
import { exportRowsToCsv, getReviews, replyToReview } from "@/app/lib/milestones";

function formatDate(dateString) {
  if (!dateString) return "Date unavailable";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStatus(status) {
  return (status ?? "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function OwnerCarBookingsContent() {
  const { id: carId } = useParams();

  const [state, setState] = useState({
    loading: true,
    user: null,
    car: null,
    bookings: [],
    reviews: [],
    error: "",
  });

  const [feedback, setFeedback] = useState("");
  const [busyBookingId, setBusyBookingId] = useState("");

  function loadOwnerBookings(userId, selectedCarId) {
    const car = getCars().find(
      (item) => item.id === selectedCarId && item.ownerId === userId
    );

    if (!car) {
      setState({
        loading: false,
        user: getCurrentSession(),
        car: null,
        bookings: [],
        error: "This car is unavailable or does not belong to your account.",
      });
      return;
    }

    const bookings = getBookings()
      .filter(
        (booking) =>
          booking.carId === car.id &&
          booking.ownerId === userId
      )
      .sort((a, b) => (a.startDate > b.startDate ? 1 : -1));

    setState({
      loading: false,
      user: getCurrentSession(),
      car,
      bookings,
      reviews: getReviews().filter((review) => review.ownerId === userId && review.carId === car.id),
      error: "",
    });
  }

  useEffect(() => {
    const initialized = initializeDemoData();

    if (!initialized.ok) {
      setState({
        loading: false,
        user: null,
        car: null,
        bookings: [],
        error: initialized.error,
      });
      return;
    }

    const user = getCurrentSession();

    if (!user) {
      setState({
        loading: false,
        user: null,
        car: null,
        bookings: [],
        error: "",
      });
      return;
    }

    if (!hasRole(user, "owner")) {
      setState({
        loading: false,
        user,
        car: null,
        bookings: [],
        error: "Only owner accounts can view booking requests.",
      });
      return;
    }

    loadOwnerBookings(user.id, carId);
    const refreshBookings = () => {
      const currentUser = getCurrentSession();
      if (currentUser?.id === user.id && hasRole(currentUser, "owner")) loadOwnerBookings(currentUser.id, carId);
    };
    window.addEventListener("storage", refreshBookings);
    window.addEventListener("focus", refreshBookings);
    return () => {
      window.removeEventListener("storage", refreshBookings);
      window.removeEventListener("focus", refreshBookings);
    };
  }, [carId]);

  function handleTransition(bookingId, nextStatus) {
    setFeedback("");
    setBusyBookingId(bookingId);

    // The helper independently checks session, owner, booking state,
    // ownership, and date conflicts before saving.
    const result = transitionBooking({ bookingId, nextStatus });

    if (!result.ok) {
      setFeedback(result.error);
      setBusyBookingId("");
      return;
    }

    setFeedback(({ approved: "Booking approved. Add payment instructions below when ready.", declined: "Booking request declined.", confirmed: "Simulated payment confirmed; the rental is confirmed.", in_progress: "Rental marked in progress.", completed: "Rental marked complete." })[nextStatus] || "Booking updated.");

    if (state.user) {
      loadOwnerBookings(state.user.id, carId);
    }

    setBusyBookingId("");
  }

  function handleSavePaymentInstructions(event, bookingId) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusyBookingId(bookingId);
    const result = setBookingPaymentInstructions({ bookingId, paymentInstructions: { method: data.get("method"), details: data.get("details") } });
    setFeedback(result.ok ? "Payment instructions saved. The renter can now continue to checkout." : result.error);
    if (result.ok && state.user) loadOwnerBookings(state.user.id, carId);
    setBusyBookingId("");
  }

  function handleReply(event, reviewId) {
    event.preventDefault();
    const reply = new FormData(event.currentTarget).get("reply");
    const result = replyToReview({ reviewId, reply });
    setFeedback(result.ok ? "Your reply was saved." : result.error);
    if (result.ok && state.user) loadOwnerBookings(state.user.id, carId);
  }

  function handleExport() {
    const actor = getCurrentSession();
    if (!state.user || !actor || actor.id !== state.user.id || !hasRole(actor, "owner") || !state.car || state.car.ownerId !== actor.id) {
      setFeedback("Only this car's signed-in owner can export its bookings.");
      return;
    }
    const ownCar = getCars().find((car) => car.id === carId && car.ownerId === actor.id);
    if (!ownCar) {
      setFeedback("This car is unavailable or does not belong to your account.");
      return;
    }
    const rows = getBookings().filter((booking) => booking.carId === ownCar.id && booking.ownerId === actor.id).map((booking) => [booking.id, booking.renterId, booking.startDate, booking.endDate, booking.days, booking.pricePerDay, booking.subtotal, booking.fee, booking.total, booking.status, booking.paymentStatus || "unpaid"]);
    const result = exportRowsToCsv(`${ownCar.id}-bookings-earnings.csv`, ["Booking ID", "Renter ID", "Pick-up", "Return", "Rental days", "Daily price ETB", "Subtotal ETB", "Fee ETB", "Total ETB", "Booking status", "Payment status"], rows);
    setFeedback(result.ok ? `Exported ${rows.length} booking record${rows.length === 1 ? "" : "s"}.` : result.error);
  }

  return (
    <>
      <SiteHeader />

      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          <Link className="back-link" href="/owner/cars">
            <span aria-hidden="true">←</span> My cars
          </Link>

          {state.loading ? (
            <p className="catalogue-loading" role="status">
              Loading booking requests…
            </p>
          ) : !state.user ? (
            <div className="empty-state">
              <h1>Sign in as an owner.</h1>
              <p>Sign in to respond to booking requests for your cars.</p>
              <Link
                className="button button-primary"
                href={`/signin?next=${encodeURIComponent(
                  `/owner/cars/${carId}/bookings`
                )}`}
              >
                Sign in <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : state.error ? (
            <div className="empty-state">
              <h1>Requests unavailable</h1>
              <p>{state.error}</p>
              <Link className="button button-primary" href="/owner/cars">
                Back to my cars <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="catalogue-title">
                <div>
                  <span className="eyebrow">OWNER REQUESTS</span>
                  <h1>
                    {state.car.make} {state.car.model}
                  </h1>
                          <p>Review requests, provide payment instructions after approval, then verify renter references.</p>
                </div>
                <span className="catalogue-demo-tag">
                  <span aria-hidden="true" />
                  BOOKING REQUESTS
                </span>
              </div>

              <div className="owner-booking-export"><button className="button button-primary" type="button" onClick={handleExport}>Export this car's bookings and earnings</button></div>

              {feedback && (
                <p
                  role="status"
                  style={{ marginBlock: "14px", color: "#174638", fontSize: "12px" }}
                >
                  {feedback}
                </p>
              )}

              {state.bookings.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon" aria-hidden="true">⌕</span>
                  <h2>No booking requests yet.</h2>
                  <p>Requests for this car will appear here.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "14px" }}>
                  {state.bookings.map((booking) => (
                    <article className="car-card" key={booking.id}>
                      <div className="car-card-body">
                        <div className="results-row" style={{ marginTop: 0 }}>
                          <div>
                            <p className="car-year">RENTER BOOKING</p>
                            <h2 style={{ margin: "7px 0", fontSize: "17px" }}>
                              {formatDate(booking.startDate)} –{" "}
                              {formatDate(booking.endDate)}
                            </h2>
                          </div>
                          <span className="availability-note">
                            {formatStatus(booking.status)}
                          </span>
                        </div>

                        <div className="car-specs">
                          <span>
                            {booking.days}{" "}
                            {booking.days === 1 ? "day" : "days"}
                          </span>
                          <span>
                            Total: {formatPrice(booking.total ?? 0)}
                          </span>
                        </div>

                        <p className="demo-note">
                          Booking ID: {booking.id}
                        </p>

                        {["pending", "requested"].includes(booking.status) && <div className="owner-request-actions"><p>Approve this request first. You can add payment instructions afterward; no payment is collected while it is pending.</p><button className="button button-primary" type="button" disabled={busyBookingId === booking.id} onClick={() => handleTransition(booking.id, "approved")}>Approve request</button><button className="button button-dark" type="button" disabled={busyBookingId === booking.id} onClick={() => handleTransition(booking.id, "declined")}>Decline request</button></div>}
                        {booking.status === "approved" && !booking.paymentInstructions && <div className="details-panel milestone-panel"><h3>Add payment instructions</h3><p>The request is approved. The renter will see checkout only after you save these instructions.</p><form className="milestone-form" onSubmit={(event) => handleSavePaymentInstructions(event, booking.id)}><label>Payment method<select name="method" defaultValue="telebirr"><option value="telebirr">Demo TeleBirr</option><option value="bank_transfer">Bank transfer</option></select></label><label>Payment instructions<textarea name="details" minLength={3} maxLength={500} rows={3} required placeholder="Example: Demo TeleBirr number 09… or CBE transfer instructions" /></label><button className="button button-primary" type="submit" disabled={busyBookingId === booking.id}>{busyBookingId === booking.id ? "Saving…" : "Save payment instructions"}</button></form></div>}
                        {booking.status === "approved" && booking.paymentInstructions && <div className="request-info" style={{ marginTop: 14 }}><strong>Payment instructions shared</strong><p>{booking.paymentInstructions.method === "telebirr" ? "Demo TeleBirr" : "Bank transfer"}: {booking.paymentInstructions.details}</p><small>Waiting for renter to submit a demo payment reference.</small></div>}
                        {booking.status === "payment_submitted" && <div className="request-info" style={{ marginTop: 14 }}><strong>Demo payment reference submitted</strong><p>{booking.paymentReference}</p><p>Check your own payment records, then confirm this simulated payment.</p><button className="button button-primary" type="button" disabled={busyBookingId === booking.id} onClick={() => handleTransition(booking.id, "confirmed")}>Verify demo payment and confirm</button></div>}
                        {booking.status === "confirmed" && (
                          <button className="button button-primary" type="button" disabled={busyBookingId === booking.id} onClick={() => handleTransition(booking.id, "in_progress")}>Mark rental in progress</button>
                        )}
                        {booking.status === "in_progress" && (
                          <button className="button button-primary" type="button" disabled={busyBookingId === booking.id} onClick={() => handleTransition(booking.id, "completed")}>Mark rental complete</button>
                        )}
                        {state.reviews.filter((review) => review.bookingId === booking.id).map((review) => (
                          <div className="request-info" key={review.id} style={{ marginTop: 14 }}>
                            <div><strong>Renter review · {"★".repeat(review.rating)}</strong><p>{review.comment}</p>
                              {review.ownerReply ? <p><strong>Your reply:</strong> {review.ownerReply}</p> : (
                                <form className="milestone-form" onSubmit={(event) => handleReply(event, review.id)}>
                                  <label>Reply to the renter<textarea name="reply" minLength={2} maxLength={1000} rows={2} required placeholder="Write a helpful response" /></label>
                                  <button className="button button-primary" type="submit">Post reply</button>
                                </form>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <p className="demo-note catalogue-demo-note">
                Owner decisions are saved with the booking record.
              </p>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

export default function OwnerCarBookingsPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader />
          <main className="catalogue-main">
            <section className="page-width catalogue-layout">
              <p className="catalogue-loading" role="status">
                Loading booking requests…
              </p>
            </section>
          </main>
          <SiteFooter />
        </>
      }
    >
      <OwnerCarBookingsContent />
    </Suspense>
  );
}
