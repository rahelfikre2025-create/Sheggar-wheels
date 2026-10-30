"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { createBooking, calculateDays, calculatePrice } from "@/app/lib/bookings";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import { getCars, initializeDemoData, SESSION_KEYS } from "@/app/lib/storage";
import { formatPrice } from "@/app/lib/data/cars";

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export default function CheckoutPage() {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, user: null, car: null, draft: null, error: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const initialized = initializeDemoData();
    const user = getCurrentSession();
    let draft = null;
    try {
      const stored = window.sessionStorage.getItem(SESSION_KEYS.checkoutDraft);
      draft = stored ? JSON.parse(stored) : null;
    } catch {
      draft = null;
    }

    if (!initialized.ok) {
      setState({ loading: false, user, car: null, draft, error: initialized.error });
      return;
    }
    if (!draft?.carId || !draft.pickup || !draft.returnDate) {
      setState({ loading: false, user, car: null, draft: null, error: "Your checkout details are missing. Choose your rental dates again." });
      return;
    }

    const car = getCars().find((item) => item.id === draft.carId && item.status === "approved") || null;
    setState({ loading: false, user, car, draft, error: car ? "" : "This listing is no longer available. Return to the catalogue and choose another car." });
  }, []);

  const days = state.draft ? calculateDays(state.draft.pickup, state.draft.returnDate) : 0;
  const quote = calculatePrice(days, state.car?.pricePerDay);

  function submitCheckout(event) {
    event.preventDefault();
    setMessage("");
    if (!state.user) {
      router.push(`/signin?next=${encodeURIComponent("/checkout")}`);
      return;
    }
    if (!hasRole(state.user, "renter")) {
      setMessage("A renter account is required to continue with checkout.");
      return;
    }
    if (!state.car || !state.draft || days < 1) {
      setMessage("The booking details are invalid. Please select your dates again.");
      return;
    }

    setBusy(true);
    const result = createBooking({
      carId: state.car.id,
      pickup: state.draft.pickup,
      returnDate: state.draft.returnDate,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    try {
      window.sessionStorage.removeItem(SESSION_KEYS.checkoutDraft);
    } catch {
      // The saved booking remains valid even if draft cleanup fails.
    }
    router.replace(`/bookings/${result.booking.id}/confirmation`);
  }

  return (
    <>
      <SiteHeader />
      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          <Link className="back-link" href={state.car ? `/cars/${state.car.id}#rental-dates` : "/cars"}><span aria-hidden="true">←</span> Back to car</Link>
          <div className="catalogue-title"><div><span className="eyebrow">BOOKING REQUEST</span><h1>Review your trip.</h1><p>Check the booking details before sending your request to the car owner.</p></div><span className="catalogue-demo-tag"><span /> NO PAYMENT YET</span></div>

          {state.loading ? <p className="catalogue-loading" role="status">Preparing checkout…</p> : state.error ? (
            <div className="empty-state"><span className="empty-icon" aria-hidden="true">!</span><h2>Checkout unavailable</h2><p>{state.error}</p><Link className="button button-primary" href="/cars">Browse cars <span aria-hidden="true">↗</span></Link></div>
          ) : (
            <div className="checkout-layout">
              <section className="details-panel checkout-summary" aria-labelledby="checkout-summary-heading">
                <h2 id="checkout-summary-heading">Booking summary</h2><h3>{state.car.year} {state.car.make} {state.car.model}</h3><p className="checkout-location">{state.car.location}</p>
                <dl className="details-specs">
                  <div><dt>Pick-up</dt><dd>{formatDate(state.draft.pickup)}</dd></div>
                  <div><dt>Return</dt><dd>{formatDate(state.draft.returnDate)}</dd></div>
                  <div><dt>Duration</dt><dd>{days} {days === 1 ? "day" : "days"}</dd></div>
                  <div><dt>Daily rate</dt><dd>{formatPrice(state.car.pricePerDay)}</dd></div>
                  <div><dt>Service fee</dt><dd>{formatPrice(quote.fee)}</dd></div>
                  <div><dt>Total estimate</dt><dd>{formatPrice(quote.total)}</dd></div>
                </dl>
              </section>
              <section className="details-panel checkout-action" aria-labelledby="mock-checkout-heading">
                <span className="eyebrow">REQUEST STATUS</span><h2 id="mock-checkout-heading">Send booking request.</h2>
                <p>No payment is collected now. If the owner approves, they will add payment instructions to this booking.</p>
                <p className="checkout-approval-note">The booking remains pending until the owner reviews it. Payment instructions appear only after approval.</p>
                {!state.user && <p className="checkout-approval-note">Sign in with a renter account to send this request.</p>}
                {message && <p className="checkout-message" role="alert">{message}</p>}
                <form onSubmit={submitCheckout}><button className="button button-primary booking-button" type="submit" disabled={busy}>{busy ? "Sending request…" : "Submit booking request"}<span aria-hidden="true">↗</span></button></form>
              </section>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
