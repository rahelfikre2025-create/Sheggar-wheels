"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import {
  getBookings,
  getCars,
  initializeDemoData,
} from "@/app/lib/storage";
import { formatPrice } from "@/app/lib/data/cars";

function formatDate(dateString) {
  if (!dateString) return "Date not available";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function BookingCard({ booking, car }) {
  const carName = car
    ? `${car.year} ${car.make} ${car.model}`
    : "Car listing";

  return (
    <article className="renter-trip-card">
      <Link className="renter-trip-image" href={`/cars/${booking.carId}`} aria-label={`View ${carName}`}>
        {car?.image ? <Image src={car.image} alt={car.imageAlt || carName} fill sizes="(max-width: 700px) 100vw, 220px" /> : <span aria-hidden="true">🚘</span>}
        <span>{carName}</span>
      </Link>
      <div className="renter-trip-main">
        <div className="renter-trip-title"><div><span className="eyebrow">{car?.location || "ADDIS ABABA"}</span><h3>{carName}</h3></div><span className={`renter-status renter-status-${booking.status}`}>{formatStatus(booking.status)}</span></div>
        <div className="renter-trip-facts"><span>♧ {car?.transmission || "Vehicle"}</span><span>♙ {car?.seats || "—"} seats</span><span>◷ {booking.days} {booking.days === 1 ? "day" : "days"}</span></div>
        <div className="renter-trip-dates"><span>▣ {formatDate(booking.startDate)}</span><span aria-hidden="true">→</span><span>{formatDate(booking.endDate)}</span></div>
        <p className="renter-trip-total">{formatPrice(booking.pricePerDay ?? car?.pricePerDay ?? 0)} <small>/ day</small><span>·</span>Total: <strong>{formatPrice(booking.total ?? 0)}</strong></p>
        <p className="renter-trip-reference">Booking reference: {booking.id}</p>
      </div>
      <div className="renter-trip-action">
        {booking.status === "approved" ? <><span className="renter-action-hint">{booking.paymentInstructions ? "Owner instructions are ready." : "Approved by the owner."}</span>{booking.paymentInstructions && <div className="renter-payment-preview"><strong>Payment instructions</strong><span>{booking.paymentInstructions.method === "telebirr" ? "Demo TeleBirr" : "Bank transfer"}</span><small>{booking.paymentInstructions.details}</small></div>}<Link className="button button-primary" href={`/bookings/${booking.id}`}>{booking.paymentInstructions ? "Proceed to checkout" : "View booking"}<span aria-hidden="true">↗</span></Link></> : booking.status === "payment_submitted" ? <><span className="renter-action-hint">Waiting for owner verification.</span><Link className="button button-outline" href={`/bookings/${booking.id}`}>View booking</Link></> : booking.status === "confirmed" ? <><span className="renter-action-hint">Payment verified. Your rental is confirmed.</span><Link className="button button-outline" href={`/bookings/${booking.id}`}>View receipt</Link></> : <><span className="renter-action-hint">{booking.status === "pending" || booking.status === "requested" ? "Waiting for owner’s response." : "View booking status and details."}</span><Link className="button button-outline" href={`/bookings/${booking.id}`}>View details</Link></>}
      </div>
    </article>
  );
}

function DashboardContent() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState({
    loading: true,
    user: null,
    cars: [],
    bookings: [],
    error: "",
  });

  useEffect(() => {
    const initResult = initializeDemoData();

    if (!initResult.ok) {
      setView({
        loading: false,
        user: null,
        cars: [],
        bookings: [],
        error: initResult.error,
      });
      return;
    }

    const user = getCurrentSession();

    if (!user) {
      setView({
        loading: false,
        user: null,
        cars: [],
        bookings: [],
        error: "",
      });
      return;
    }

    if (!hasRole(user, "renter")) {
      setView({
        loading: false,
        user,
        cars: [],
        bookings: [],
        error: "This dashboard is for renter accounts.",
      });
      return;
    }

    const allBookings = getBookings();
    const cars = getCars();

    // Only include bookings owned by the currently signed-in renter.
    const renterBookings = allBookings
      .filter((booking) => booking.renterId === user.id)
      .sort((a, b) => (a.startDate > b.startDate ? 1 : -1));

    setView({
      loading: false,
      user,
      cars,
      bookings: renterBookings,
      error: "",
    });

    const refreshBookings = () => {
      const currentUser = getCurrentSession();
      if (!currentUser || currentUser.id !== user.id || !hasRole(currentUser, "renter")) return;
      setView((current) => ({
        ...current,
        user: currentUser,
        cars: getCars(),
        bookings: getBookings()
          .filter((booking) => booking.renterId === currentUser.id)
          .sort((a, b) => (a.startDate > b.startDate ? 1 : -1)),
      }));
    };
    window.addEventListener("storage", refreshBookings);
    window.addEventListener("sw-storage", refreshBookings);
    window.addEventListener("focus", refreshBookings);
    const refreshTimer = window.setInterval(refreshBookings, 2000);
    return () => {
      window.removeEventListener("storage", refreshBookings);
      window.removeEventListener("sw-storage", refreshBookings);
      window.removeEventListener("focus", refreshBookings);
      window.clearInterval(refreshTimer);
    };
  }, []);

  const visibleBookings = statusFilter === "all"
    ? view.bookings
    : view.bookings.filter((booking) => booking.status === statusFilter);
  const renterStats = [
    { label: "Total trips", value: view.bookings.length, icon: "🚘" },
    { label: "Ongoing", value: view.bookings.filter((booking) => ["confirmed", "in_progress"].includes(booking.status)).length, icon: "◷" },
    { label: "Completed", value: view.bookings.filter((booking) => booking.status === "completed").length, icon: "✓" },
    { label: "Pending", value: view.bookings.filter((booking) => ["pending", "requested"].includes(booking.status)).length, icon: "▣" },
  ];
  const statusFilters = ["all", "pending", "approved", "payment_submitted", "confirmed", "in_progress", "completed", "declined", "cancelled"];

  return (
    <>
      <SiteHeader />

      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          <div className={`catalogue-title ${view.user ? "renter-top-heading" : ""}`}>
            <div>
              <span className="eyebrow">RENTER DASHBOARD</span>
              <h1>
                {view.user ? `Welcome, ${view.user.name}.` : "Your trips."}
              </h1>
              <p>See your upcoming rentals and past booking activity.</p>
            </div>

            <span className="catalogue-demo-tag">
              <span aria-hidden="true" />
              MY ACCOUNT
            </span>
          </div>

          {view.loading ? (
            <p className="catalogue-loading" role="status">
              Loading your bookings…
            </p>
          ) : view.error ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">
                !
              </span>
              <h2>Dashboard unavailable</h2>
              <p>{view.error}</p>
              <Link className="button button-primary" href="/cars">
                Browse cars <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : !view.user ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">
                ↗
              </span>
              <h2>Sign in to see your trips.</h2>
              <p>
                Sign in with your renter account to view your booking history.
              </p>
              <Link
                className="button button-primary"
                href="/signin?next=%2Fdashboard"
              >
                Continue to sign in <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : (
            <div className="renter-dashboard-shell">
              <aside className="renter-dashboard-sidebar" aria-label="Renter dashboard navigation">
                <div className="renter-profile-mini"><span className="renter-avatar">{view.user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong>{view.user.name}</strong><small>Renter account</small></span></div>
                <nav><a className="active" href="#my-trips">▣ <span>My Trips</span></a><Link href="/cars">⌕ <span>Browse Cars</span></Link><Link href="/bookings">▤ <span>Booking history</span></Link></nav>
                <Link className="renter-sidebar-promo" href="/cars"><strong>Explore Addis<br />your way</strong><span>Find a car for your next journey around the city.</span><b>Browse cars ↗</b></Link>
              </aside>

              <div className="renter-dashboard-content">
                <section className="renter-welcome-hero" style={view.cars[0]?.image ? { backgroundImage: `linear-gradient(90deg, rgba(240,247,244,.97) 0%, rgba(240,247,244,.83) 46%, rgba(20,50,45,.06) 100%), url("${view.cars[0].image}")` } : undefined}>
                  <span className="eyebrow">YOUR SHEGGAR WHEELS ACCOUNT</span>
                  <h2>Good to see you, {view.user.name.split(" ")[0]}.</h2>
                  <h3>Your journeys, all in one place.</h3>
                  <p>Track your bookings, check status, and get ready for your next trip around Addis Ababa.</p>
                  <div className="renter-stat-grid">{renterStats.map((stat) => <article className="renter-stat-card" key={stat.label}><span aria-hidden="true">{stat.icon}</span><strong>{stat.value}</strong><small>{stat.label}</small></article>)}</div>
                </section>

                <section id="my-trips" className="renter-trips-section" aria-labelledby="my-trips-heading">
                  <div className="renter-trips-heading"><div><h2 id="my-trips-heading">My Trips</h2><p>View and manage your car rental bookings.</p></div><Link className="button button-primary" href="/cars">Find a car <span aria-hidden="true">↗</span></Link></div>
                  <div className="renter-status-filters" role="group" aria-label="Filter trips by status">{statusFilters.map((status) => <button type="button" key={status} className={statusFilter === status ? "active" : ""} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>{status === "all" ? "All" : formatStatus(status)}<span>{status === "all" ? view.bookings.length : view.bookings.filter((booking) => booking.status === status).length}</span></button>)}</div>
                  {visibleBookings.length ? <div className="renter-trip-list">{visibleBookings.map((booking) => <BookingCard key={booking.id} booking={booking} car={view.cars.find((item) => item.id === booking.carId)} />)}</div> : <div className="renter-empty-trips"><span aria-hidden="true">🚘</span><h3>{view.bookings.length ? `No ${statusFilter} bookings` : "Your next trip starts here"}</h3><p>{view.bookings.length ? "Choose another status to see your bookings." : "Browse available cars and send a booking request to get started."}</p>{!view.bookings.length && <Link className="button button-primary" href="/cars">Explore available cars <span aria-hidden="true">↗</span></Link>}</div>}
                </section>
              </div>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader />
          <main className="catalogue-main">
            <section className="page-width catalogue-layout">
              <p className="catalogue-loading" role="status">
                Loading your bookings…
              </p>
            </section>
          </main>
          <SiteFooter />
        </>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
