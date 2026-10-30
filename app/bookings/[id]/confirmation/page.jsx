"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import { getBookings, getCars, initializeDemoData } from "@/app/lib/storage";
import { formatPrice } from "@/app/lib/data/cars";

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function ConfirmationContent() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, user: null, booking: null, car: null });

  useEffect(() => {
    initializeDemoData();
    const user = getCurrentSession();
    const booking = user && hasRole(user, "renter")
      ? getBookings().find((item) => item.id === id && item.renterId === user.id)
      : null;
    const car = booking ? getCars().find((item) => item.id === booking.carId) : null;
    setState({ loading: false, user, booking, car });
  }, [id]);

  return (
    <>
      <SiteHeader />
      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          {state.loading ? <p className="catalogue-loading" role="status">Loading confirmation…</p> : !state.booking ? (
            <div className="empty-state"><span className="empty-icon" aria-hidden="true">!</span><h1>Confirmation unavailable</h1><p>Sign in as the renter who submitted this request to see its confirmation.</p><Link className="button button-primary" href={`/signin?next=${encodeURIComponent(`/bookings/${id}/confirmation`)}`}>Sign in to continue <span aria-hidden="true">↗</span></Link></div>
          ) : (
            <>
              <section className="details-panel booking-confirmation" aria-labelledby="confirmation-heading">
                <span className="confirmation-check" aria-hidden="true">✓</span>
                <span className="eyebrow">REQUEST RECEIVED</span>
                <h1 id="confirmation-heading">Your request has been sent.</h1>
                <p className="request-sent-message">Your booking request has been sent to the car owner. Follow its status in My Trips; you can enable browser notifications there. Payment instructions and checkout appear only after the owner approves it.</p>
                <p className="confirmation-no-payment">No payment was collected with this request. Payments in this project are simulated only.</p>
              </section>

              <section className="details-panel confirmation-summary" aria-labelledby="confirmation-summary-heading">
                <div className="catalogue-title"><div><span className="eyebrow">BOOKING REFERENCE</span><h2 id="confirmation-summary-heading">{state.car ? `${state.car.year} ${state.car.make} ${state.car.model}` : "Your car booking"}</h2></div><span className="catalogue-demo-tag"><span /> PENDING</span></div>
                <dl className="details-specs">
                  <div><dt>Booking ID</dt><dd>{state.booking.id}</dd></div>
                  <div><dt>Pick-up</dt><dd>{formatDate(state.booking.startDate)}</dd></div>
                  <div><dt>Return</dt><dd>{formatDate(state.booking.endDate)}</dd></div>
                  <div><dt>Duration</dt><dd>{state.booking.days} {state.booking.days === 1 ? "day" : "days"}</dd></div>
                  <div><dt>Daily rate</dt><dd>{formatPrice(state.booking.pricePerDay || 0)}</dd></div>
                  <div><dt>Estimated total</dt><dd>{formatPrice(state.booking.total || 0)}</dd></div>
                  <div><dt>Payment</dt><dd>Not collected · awaiting owner review</dd></div>
                </dl>
                <div className="confirmation-actions"><Link className="button button-primary" href={`/bookings/${state.booking.id}`}>View booking details <span aria-hidden="true">↗</span></Link><Link className="text-link" href="/bookings">My bookings</Link></div>
              </section>
            </>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

export default function BookingConfirmationPage() {
  return <Suspense fallback={<><SiteHeader /><main className="catalogue-main"><section className="page-width catalogue-layout"><p className="catalogue-loading" role="status">Loading confirmation…</p></section></main><SiteFooter /></>}><ConfirmationContent /></Suspense>;
}
