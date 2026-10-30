"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import { getBookings, getCars, initializeDemoData } from "@/app/lib/storage";
import { formatPrice } from "@/app/lib/data/cars";
import { exportRowsToCsv } from "@/app/lib/milestones";

const UTILIZATION_STATUSES = ["confirmed", "in_progress", "completed"];

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

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlySummary(cars, bookings, now) {
  if (!now) return [];
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
    return { key: monthKey(date), label: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date), revenue: 0, bookedDaysByCar: new Map(), daysInMonth: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate() };
  });
  const monthIndex = new Map(months.map((month, index) => [month.key, index]));
  const carIds = new Set(cars.filter((car) => car.status === "approved").map((car) => car.id));

  bookings.forEach((booking) => {
    if (!carIds.has(booking.carId)) return;
    if (booking.status === "completed") {
      const completionMonth = (booking.endDate || booking.updatedAt || "").slice(0, 7);
      const index = monthIndex.get(completionMonth);
      if (index !== undefined) months[index].revenue += Number(booking.total) || 0;
    }
    if (!UTILIZATION_STATUSES.includes(booking.status)) return;
    const start = Date.parse(`${booking.startDate}T00:00:00.000Z`);
    const end = Date.parse(`${booking.endDate}T00:00:00.000Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    for (let timestamp = start; timestamp < end; timestamp += 86_400_000) {
      const key = monthKey(new Date(timestamp));
      const month = months[monthIndex.get(key)];
      if (!month) continue;
      if (!month.bookedDaysByCar.has(booking.carId)) month.bookedDaysByCar.set(booking.carId, new Set());
      month.bookedDaysByCar.get(booking.carId).add(new Date(timestamp).toISOString().slice(0, 10));
    }
  });

  return months.map((month) => {
    const bookedDays = [...month.bookedDaysByCar.values()].reduce((sum, days) => sum + days.size, 0);
    const availableDays = carIds.size * month.daysInMonth;
    return { month: month.label, revenue: month.revenue, utilization: availableDays ? Math.round((bookedDays / availableDays) * 100) : 0, bookedDays };
  });
}

function OwnerDashboardContent() {
  const [state, setState] = useState({ loading: true, user: null, cars: [], bookings: [], error: "" });
  const [feedback, setFeedback] = useState("");
  const [reportDate, setReportDate] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setReportDate(new Date()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadOwnerData = useCallback(() => {
    const initialized = initializeDemoData();
    if (!initialized.ok) {
      setState({ loading: false, user: null, cars: [], bookings: [], error: initialized.error });
      return;
    }
    const user = getCurrentSession();
    if (!user) {
      setState({ loading: false, user: null, cars: [], bookings: [], error: "" });
      return;
    }
    if (!hasRole(user, "owner")) {
      setState({ loading: false, user, cars: [], bookings: [], error: "This page is for owner accounts." });
      return;
    }
    const cars = getCars().filter((car) => car.ownerId === user.id);
    const carIds = new Set(cars.map((car) => car.id));
    const bookings = getBookings().filter((booking) => booking.ownerId === user.id && carIds.has(booking.carId));
    setState({ loading: false, user, cars, bookings, error: "" });
  }, []);

  useEffect(() => {
    loadOwnerData();
    window.addEventListener("storage", loadOwnerData);
    window.addEventListener("focus", loadOwnerData);
    return () => {
      window.removeEventListener("storage", loadOwnerData);
      window.removeEventListener("focus", loadOwnerData);
    };
  }, [loadOwnerData]);

  const requestedCount = state.bookings.filter((booking) => ["pending", "requested"].includes(booking.status)).length;
  const confirmedCount = state.bookings.filter((booking) => booking.status === "confirmed").length;
  const approvedCount = state.bookings.filter((booking) => booking.status === "approved").length;
  const paymentReviewCount = state.bookings.filter((booking) => booking.status === "payment_submitted").length;
  const ownerAttentionBookings = state.bookings
    .filter((booking) => ["pending", "requested", "payment_submitted"].includes(booking.status))
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  const completedBookings = state.bookings.filter((booking) => booking.status === "completed");
  const completedEarnings = completedBookings.reduce((sum, booking) => sum + (Number(booking.total) || 0), 0);
  const monthly = useMemo(() => buildMonthlySummary(state.cars, state.bookings, reportDate), [state.cars, state.bookings, reportDate]);
  const averageUtilization = monthly.length ? Math.round(monthly.reduce((sum, item) => sum + item.utilization, 0) / monthly.length) : 0;

  function handleExport() {
    const actor = getCurrentSession();
    if (!state.user || !actor || actor.id !== state.user.id || !hasRole(actor, "owner")) {
      setFeedback("Only the signed-in owner can export this report.");
      return;
    }
    const ownerCars = getCars().filter((car) => car.ownerId === actor.id);
    const ownerCarIds = new Set(ownerCars.map((car) => car.id));
    const ownerBookings = getBookings().filter((booking) => booking.ownerId === actor.id && ownerCarIds.has(booking.carId));
    const exportMonthly = buildMonthlySummary(ownerCars, ownerBookings, new Date());
    const rows = [
      ...exportMonthly.map((item) => ["Monthly summary", item.month, "", "", "", item.revenue, item.bookedDays, `${item.utilization}%`, ""]),
      ...ownerBookings.map((booking) => {
        const car = ownerCars.find((item) => item.id === booking.carId);
        return ["Booking", booking.id, car ? `${car.year} ${car.make} ${car.model}` : booking.carId, booking.startDate, booking.endDate, booking.status === "completed" ? booking.total : 0, booking.days, "", booking.status];
      }),
    ];
    const result = exportRowsToCsv("sheggar-wheels-owner-earnings-utilization.csv", ["Record type", "Month or booking ID", "Car", "Pick-up", "Return", "Completed rental value ETB", "Rental days", "Utilization", "Booking status"], rows);
    setFeedback(result.ok ? "Your owner summary CSV has been downloaded." : result.error);
  }

  return <>
    <SiteHeader />
    <main className="catalogue-main"><section className="page-width catalogue-layout">
      <div className={`catalogue-title ${state.user ? "owner-top-heading" : ""}`}><div><span className="eyebrow">OWNER DASHBOARD</span><h1>{state.user ? `Welcome, ${state.user.name}.` : "Your cars."}</h1><p>Manage listings, booking requests, and rental performance.</p></div><span className="catalogue-demo-tag"><span aria-hidden="true" /> OWNER ACCOUNT</span></div>
      {state.loading ? <p className="catalogue-loading" role="status">Loading your owner dashboard…</p> : !state.user ? <div className="empty-state"><h2>Sign in as an owner.</h2><p>Sign in to manage your car listings and rental requests.</p><Link className="button button-primary" href="/signin?next=%2Fowner">Sign in <span aria-hidden="true">↗</span></Link></div> : state.error ? <div className="empty-state"><h2>Owner dashboard unavailable</h2><p>{state.error}</p><Link className="button button-primary" href="/cars">Browse cars <span aria-hidden="true">↗</span></Link></div> : <>
        {feedback && <p className="request-info" role="status">{feedback}</p>}
        <div className="owner-dashboard-shell">
          <aside className="owner-dashboard-sidebar" aria-label="Owner dashboard sections">
            <div className="owner-sidebar-brand"><span className="owner-sidebar-mark">S</span><span><strong>OWNER SPACE</strong><small>Manage your rentals</small></span></div>
            <span className="owner-sidebar-label">WORKSPACE</span>
            <nav>
              <a className="active" href="#owner-overview"><span>◫</span> Overview</a>
              <a href="#owner-requests"><span>▤</span> Booking requests<b>{requestedCount}</b></a>
              <a href="#owner-requests"><span>✓</span> Payment verification<b>{paymentReviewCount}</b></a>
              <Link href="/owner/cars"><span>▣</span> My car listings</Link>
              <a href="#owner-earnings"><span>↗</span> Earnings</a>
              <a href="#owner-utilization"><span>◷</span> Utilization</a>
            </nav>
            <Link className="owner-sidebar-add" href="/owner/cars/new">＋ Add a car</Link>
            <div className="owner-sidebar-note">Your activity is saved in this browser.</div>
          </aside>
          <div className="owner-dashboard-content">
        <section className="owner-welcome-hero" style={state.cars[0]?.image ? { backgroundImage: `linear-gradient(90deg, rgba(239,246,242,.98) 0%, rgba(239,246,242,.84) 48%, rgba(24,55,47,.08) 100%), url("${state.cars[0].image}")` } : undefined}>
          <span className="eyebrow">OWNER DASHBOARD</span>
          <h2>Welcome back, {state.user.name.split(" ")[0]}.</h2>
          <p>Manage your cars, review booking requests, and grow your rental business with Sheggar Wheels.</p>
          <span className="owner-hero-script">Your car<br />creates opportunities</span>
        </section>
        <section id="owner-overview" className="owner-overview-section"><div className="owner-section-title"><div><span className="eyebrow">YOUR BUSINESS AT A GLANCE</span><h2>Overview</h2><p>Booking activity and performance for your listings.</p></div><span className="owner-active-tag">● OWNER ACCOUNT</span></div>
        <div className="admin-metrics owner-metrics">
          {[["YOUR LISTINGS", state.cars.length], ["REQUESTS TO REVIEW", requestedCount], ["AWAITING RENTER PAYMENT", approvedCount], ["PAYMENT REFERENCES TO VERIFY", paymentReviewCount], ["CONFIRMED RENTALS", confirmedCount], ["COMPLETED RENTAL VALUE", formatPrice(completedEarnings)], ["COMPLETED RENTALS", completedBookings.length], ["AVG. UTILIZATION · 6 MONTHS", `${averageUtilization}%`]].map(([label, value]) => <article className="car-card" key={label}><div className="car-card-body"><span className="eyebrow">{label}</span><p className="admin-metric-value">{value}</p></div></article>)}
        </div>
        <div className="owner-dashboard-quick-grid">
          <section className="owner-quick-actions"><span className="owner-quick-icon">🚘</span><h2>Quick actions</h2><p>What would you like to do today?</p><Link className="owner-quick-primary" href="/owner/cars/new">＋ <span>Add a new car</span><b>↗</b></Link><Link className="owner-quick-secondary" href="#owner-requests">▤ <span>View booking requests</span><b>{requestedCount}</b></Link></section>
          <section className="owner-recent-activity"><div className="owner-mini-heading"><div><span className="eyebrow">LATEST UPDATES</span><h2>Recent activity</h2></div><Link href="#owner-requests">View all ↗</Link></div>{state.bookings.length ? [...state.bookings].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))).slice(0, 4).map((booking) => { const activityCar = state.cars.find((car) => car.id === booking.carId); const label = booking.status === "approved" ? "Booking approved" : booking.status === "payment_submitted" ? "Payment reference submitted" : booking.status === "confirmed" ? "Payment confirmed" : booking.status === "declined" ? "Booking declined" : "Booking request received"; return <Link className="owner-activity-row" href={`/owner/cars/${booking.carId}/bookings`} key={booking.id}><span className={`owner-activity-dot owner-activity-${booking.status}`} aria-hidden="true">{booking.status === "confirmed" ? "✓" : "↗"}</span><span><strong>{label}</strong><small>{activityCar ? `${activityCar.make} ${activityCar.model}` : "Your listing"} · {formatDate((booking.updatedAt || booking.createdAt || "").slice(0, 10))}</small></span></Link>; }) : <p className="owner-activity-empty">New booking activity will appear here.</p>}</section>
        </div>
        <section id="owner-requests" className="owner-attention-panel"><div className="owner-attention-heading"><div><span className="eyebrow">ACTION REQUIRED</span><h2>Needs your attention</h2><p>New requests and payment references that need your review.</p></div><span className="owner-attention-count">{ownerAttentionBookings.length} open</span></div>
          {ownerAttentionBookings.length === 0 ? <div className="owner-attention-empty"><span aria-hidden="true">✓</span><div><strong>You’re all caught up.</strong><p>New booking requests will appear here as soon as renters send them.</p></div></div> : <div className="owner-attention-list">{ownerAttentionBookings.map((booking) => { const car = state.cars.find((item) => item.id === booking.carId); const paymentReview = booking.status === "payment_submitted"; return <article className="owner-attention-item" key={booking.id}><span className={`owner-attention-icon ${paymentReview ? "verification" : "request"}`} aria-hidden="true">{paymentReview ? "✓" : "↗"}</span><div className="owner-attention-details"><strong>{car ? `${car.year} ${car.make} ${car.model}` : "Your car"}</strong><span>{paymentReview ? "Demo payment reference to verify" : "Booking request to review"} · {booking.startDate} – {booking.endDate}</span><small>Total {formatPrice(booking.total || 0)}</small>{paymentReview && booking.paymentReference && <small>Reference: {booking.paymentReference}</small>}</div><Link className="button button-primary" href={`/owner/cars/${booking.carId}/bookings`}>{paymentReview ? "Verify payment" : "Review request"}<span aria-hidden="true">↗</span></Link></article>; })}</div>}
        </section>
        </section>
        <section className="owner-listings-panel"><div className="owner-mini-heading"><div><span className="eyebrow">YOUR FLEET</span><h2>My cars</h2><p>Manage the vehicles you have listed.</p></div><Link href="/owner/cars">View all ↗</Link></div>{state.cars.length ? <div className="owner-car-grid">{state.cars.slice(0, 3).map((car) => <article className="owner-car-tile" key={car.id}><div className="owner-car-photo" style={car.image ? { backgroundImage: `url("${car.image}")` } : undefined}><span className={`owner-car-status owner-car-status-${car.status}`}>{car.status === "approved" ? "Active" : car.status}</span></div><div className="owner-car-tile-body"><strong>{car.year} {car.make} {car.model}</strong><small>{car.location}</small><span>{formatPrice(car.pricePerDay)} <small>/ day</small></span><Link className="button button-outline" href={`/owner/cars/${car.id}/bookings`}>View details</Link></div></article>)}</div> : <div className="owner-no-listings"><p>You have not listed a car yet.</p><Link className="button button-primary" href="/owner/cars/new">Add your first car ↗</Link></div>}</section>
        <p className="owner-report-note">Earnings show the estimated total for completed rentals; this demo does not process payments. Utilization is booked days divided by available days for approved listings over the last six months.</p>
        <section id="owner-earnings" className="details-panel milestone-panel owner-report-panel">
          <div className="owner-report-heading"><div><h2>Rental earnings</h2><p>Completed rental value by month · ETB</p></div><button className="button button-primary" type="button" onClick={handleExport}>Export CSV</button></div>
          <div className="admin-chart owner-chart" role="img" aria-label="Bar chart of completed rental value by month"><ResponsiveContainer width="100%" height={270}><BarChart data={monthly} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeae4" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#77716a", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#77716a", fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat("en", { notation: "compact" }).format(value)} /><Tooltip formatter={(value) => [formatPrice(value), "Completed rental value"]} /><Bar dataKey="revenue" name="Completed rental value" fill="#2b8977" radius={[5, 5, 0, 0]} maxBarSize={48} /></BarChart></ResponsiveContainer></div>
        </section>
        <section id="owner-utilization" className="details-panel milestone-panel owner-report-panel">
          <div className="owner-report-heading"><div><h2>Car utilization</h2><p>Booked days as a share of approved car-days</p></div></div>
          {state.cars.some((car) => car.status === "approved") ? <div className="admin-chart owner-chart" role="img" aria-label="Line chart of monthly car utilization percentage"><ResponsiveContainer width="100%" height={270}><LineChart data={monthly} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeae4" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#77716a", fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tick={{ fill: "#77716a", fontSize: 10 }} /><Tooltip formatter={(value) => [`${value}%`, "Utilization"]} /><Line type="monotone" dataKey="utilization" name="Utilization" stroke="#d45c37" strokeWidth={3} dot={{ r: 4, fill: "#d45c37" }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div> : <p className="owner-no-listings">Approve a car listing to start tracking utilization.</p>}
        </section>
        <div className="owner-dashboard-links"><Link className="button button-primary" href="/owner/cars">View my cars <span aria-hidden="true">↗</span></Link><Link className="button button-dark" href="/owner/cars/new">Add a car <span aria-hidden="true">↗</span></Link></div>
          </div>
        </div>
      </>}
    </section></main>
    <SiteFooter />
  </>;
}

export default function OwnerDashboardPage() {
  return <OwnerDashboardContent />;
}
