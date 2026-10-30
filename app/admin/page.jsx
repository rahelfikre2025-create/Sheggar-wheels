"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import { getBookings, getCars, getUsers, initializeDemoData } from "@/app/lib/storage";
import { createAnnouncement, exportRowsToCsv, getAnnouncements, getDisputes, resolveDispute } from "@/app/lib/milestones";
import { approveCarListing, rejectCarListing } from "@/app/lib/listings";
import { setDemoUserStatus } from "@/app/lib/admin";
import { formatPrice } from "@/app/lib/data/cars";

function reportMonths(bookings, today) {
  if (!today) return [];
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (5 - index), 1));
    return { key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`, month: new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date), bookings: 0, commission: 0 };
  });
  const indexes = new Map(months.map((month, index) => [month.key, index]));
  bookings.forEach((booking) => {
    const sourceDate = booking.createdAt || booking.startDate || "";
    const index = indexes.get(sourceDate.slice(0, 7));
    if (index === undefined) return;
    months[index].bookings += 1;
    months[index].commission += Number(booking.fee) || 0;
  });
  return months;
}

function formatStatus(value) {
  return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatActivityDate(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(parsed);
}

const CHART_COLORS = ["#247565", "#e1a653", "#d45c37", "#6877a8", "#a6b8ad"];

function AdminDashboardContent() {
  const [state, setState] = useState({ loading: true, user: null, counts: null, cars: [], users: [], bookings: [], pendingCars: [], disputes: [], announcements: [], error: "" });
  const [feedback, setFeedback] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [reportDate, setReportDate] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setReportDate(new Date()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadAdminData = useCallback(() => {
    const user = getCurrentSession();
    if (!user) {
      setState((current) => ({ ...current, loading: false, user: null, counts: null, error: "" }));
      return;
    }
    if (!hasRole(user, "admin")) {
      setState((current) => ({ ...current, loading: false, user, counts: null, error: "This page is for the administrator." }));
      return;
    }

    const users = getUsers();
    const cars = getCars();
    const bookings = getBookings();
    setState({
      loading: false,
      user,
      counts: {
        users: users.length,
        activeUsers: users.filter((item) => item.status === "active").length,
        cars: cars.length,
        approvedCars: cars.filter((car) => car.status === "approved").length,
        pendingCars: cars.filter((car) => car.status === "pending").length,
        bookings: bookings.length,
        pendingBookings: bookings.filter((booking) => ["pending", "requested"].includes(booking.status)).length,
      },
      cars, users, bookings,
      pendingCars: cars.filter((car) => car.status === "pending"),
      disputes: getDisputes(),
      announcements: getAnnouncements(),
      error: "",
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const initialized = initializeDemoData();
      if (!initialized.ok) {
        setState({ loading: false, user: null, counts: null, cars: [], users: [], bookings: [], pendingCars: [], disputes: [], announcements: [], error: initialized.error });
      } else {
        loadAdminData();
      }
    }, 0);
    window.addEventListener("storage", loadAdminData);
    window.addEventListener("focus", loadAdminData);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", loadAdminData);
      window.removeEventListener("focus", loadAdminData);
    };
  }, [loadAdminData]);

  const monthlyData = useMemo(() => reportDate ? reportMonths(state.bookings, reportDate) : [], [state.bookings, reportDate]);
  const bookingDistribution = useMemo(() => Object.entries(state.bookings.reduce((counts, booking) => {
    counts[booking.status || "unknown"] = (counts[booking.status || "unknown"] || 0) + 1;
    return counts;
  }, {})).map(([name, value]) => ({ name: formatStatus(name), value })), [state.bookings]);
  const visibleBookings = useMemo(() => {
    const query = bookingSearch.trim().toLocaleLowerCase();
    return state.bookings.filter((booking) => {
      const car = state.cars.find((item) => item.id === booking.carId);
      const searchable = `${booking.id} ${booking.renterId} ${booking.ownerId} ${car?.make || ""} ${car?.model || ""}`.toLocaleLowerCase();
      return (!bookingStatus || booking.status === bookingStatus) && (!query || searchable.includes(query));
    }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [state.bookings, state.cars, bookingStatus, bookingSearch]);

  const todayKey = reportDate
    ? `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, "0")}-${String(reportDate.getDate()).padStart(2, "0")}`
    : "";
  const upcomingBookings = useMemo(() => state.bookings
    .filter((booking) => booking.status === "confirmed" && booking.startDate >= todayKey)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 4), [state.bookings, todayKey]);
  const recentActivity = useMemo(() => {
    const bookingItems = state.bookings.map((booking) => {
      const car = state.cars.find((item) => item.id === booking.carId);
      const renter = state.users.find((item) => item.id === booking.renterId);
      const activity = booking.paymentStatus === "mock_confirmed"
        ? "Payment confirmed"
        : booking.status === "approved"
          ? "Booking approved"
          : booking.status === "declined"
            ? "Booking declined"
            : "Booking request received";
      return { id: `booking-${booking.id}`, title: activity, detail: `${car ? `${car.year} ${car.make} ${car.model}` : "Car booking"}${renter ? ` · ${renter.name}` : ""}`, date: booking.updatedAt || booking.createdAt, icon: booking.status === "declined" ? "!" : booking.status === "confirmed" ? "✓" : "▣" };
    });
    const userItems = state.users.map((user) => ({ id: `user-${user.id}`, title: "Account registered", detail: `${user.name} · ${formatStatus(user.roles?.[0])}`, date: user.createdAt, icon: "♙" }));
    const listingItems = state.cars.map((car) => ({ id: `listing-${car.id}`, title: car.status === "approved" ? "Listing published" : car.status === "rejected" ? "Listing rejected" : "Listing submitted", detail: `${car.year} ${car.make} ${car.model}`, date: car.updatedAt || car.createdAt, icon: "▣" }));
    return [...bookingItems, ...userItems, ...listingItems]
      .filter((item) => item.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 5);
  }, [state.bookings, state.cars, state.users]);

  function handleApproveListing(carId) {
    const result = approveCarListing(carId);
    setFeedback(result.ok ? "Listing approved and published." : result.error);
    if (result.ok) loadAdminData();
  }

  function handleRejectListing(event, carId) {
    event.preventDefault();
    const reason = new FormData(event.currentTarget).get("reason");
    const result = rejectCarListing(carId, reason);
    setFeedback(result.ok ? "Listing rejected. The reason is saved with its moderation record." : result.error);
    if (result.ok) loadAdminData();
  }

  function handleUserStatus(targetUser, nextStatus) {
    const result = setDemoUserStatus(targetUser.id, nextStatus);
    setFeedback(result.ok ? `${targetUser.name} is now ${nextStatus}.` : result.error);
    if (result.ok) loadAdminData();
  }

  function handleAnnouncement(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = createAnnouncement({ title: data.get("title"), message: data.get("message"), durationDays: data.get("durationDays") });
    setFeedback(result.ok ? "Announcement published." : result.error);
    if (result.ok) { event.currentTarget.reset(); loadAdminData(); }
  }

  function handleResolve(event, disputeId) {
    event.preventDefault();
    const resolution = new FormData(event.currentTarget).get("resolution");
    const result = resolveDispute({ disputeId, resolution });
    setFeedback(result.ok ? "Issue marked resolved." : result.error);
    if (result.ok) loadAdminData();
  }

  function handleExport() {
    const actor = getCurrentSession();
    if (!actor || actor.id !== state.user?.id || !hasRole(actor, "admin")) {
      setFeedback("Only the signed-in administrator can export platform reports.");
      return;
    }
    const cars = getCars();
    const bookings = getBookings();
    const users = getUsers();
    const months = reportMonths(bookings, new Date());
    const headers = ["Record type", "Record ID", "Month", "Car or account", "Owner ID", "Renter ID", "Start date", "End date", "Status", "Booking count", "Mock commission ETB", "Booking total ETB"];
    const rows = [
      ...months.map((item) => ["Monthly report", "", item.key, "", "", "", "", "", "", item.bookings, item.commission, ""]),
      ...bookings.map((booking) => {
        const car = cars.find((item) => item.id === booking.carId);
        return ["Booking", booking.id, (booking.createdAt || booking.startDate || "").slice(0, 7), car ? `${car.year} ${car.make} ${car.model}` : booking.carId, booking.ownerId, booking.renterId, booking.startDate, booking.endDate, booking.status, 1, Number(booking.fee) || 0, Number(booking.total) || 0];
      }),
      ...cars.map((car) => ["Listing", car.id, (car.createdAt || "").slice(0, 7), `${car.year} ${car.make} ${car.model}`, car.ownerId, "", "", "", car.status, "", "", ""]),
      ...users.map((user) => ["User", user.id, (user.createdAt || "").slice(0, 7), user.name, "", "", "", "", `${(user.roles || []).join("/")} · ${user.status}`, "", "", ""]),
    ];
    const result = exportRowsToCsv("sheggar-wheels-admin-platform-report.csv", headers, rows);
    setFeedback(result.ok ? "Platform report CSV downloaded." : result.error);
  }

  const confirmedBookingValue = state.bookings
    .filter((booking) => ["confirmed", "in_progress", "completed"].includes(booking.status))
    .reduce((sum, booking) => sum + (Number(booking.total) || 0), 0);
  const metrics = state.counts ? [
    ["APPROVED CARS", state.counts.approvedCars, "Active public listings", "🚘"],
    ["TOTAL BOOKINGS", state.counts.bookings, `${state.counts.pendingBookings} awaiting owner review`, "▣"],
    ["REGISTERED USERS", state.counts.users, `${state.counts.activeUsers} active accounts`, "♙"],
    ["CONFIRMED VALUE", formatPrice(confirmedBookingValue), "Verified rental value · demo", "ETB"],
  ] : [];
  return <>
    <main className="catalogue-main"><section className="page-width catalogue-layout">
      <div className={`catalogue-title ${state.user ? "admin-top-heading" : ""}`}><div><span className="eyebrow">PLATFORM OVERVIEW</span><h1>Admin dashboard.</h1><p>Moderate listings, manage demo accounts, and review platform activity.</p></div><span className="catalogue-demo-tag"><span aria-hidden="true" /> ADMINISTRATOR</span></div>
      {state.loading ? <p className="catalogue-loading" role="status">Loading admin overview…</p> : !state.user ? <div className="empty-state"><h2>Admin sign-in required</h2><p>Sign in with the administrator demo account.</p><Link className="button button-primary" href="/signin?role=admin">Admin sign-in <span aria-hidden="true">↗</span></Link></div> : state.error ? <div className="empty-state"><h2>Admin dashboard unavailable</h2><p>{state.error}</p></div> : <>
        {feedback && <p className="request-info" role="status">{feedback}</p>}
        <div className="admin-dashboard-shell"><aside className="admin-sidebar" aria-label="Admin dashboard sections"><div className="admin-sidebar-brand"><span className="admin-sidebar-mark">S</span><div><strong>SHEGGAR WHEELS</strong><small>Platform admin</small></div></div><span className="admin-nav-label">WORKSPACE</span><nav><a className="active" href="#overview">⌂ <span>Dashboard</span></a><a href="#listings">▣ <span>Cars</span><b>{state.pendingCars.length}</b></a><a href="#bookings">▤ <span>Bookings</span><b>{state.counts?.pendingBookings || ""}</b></a><a href="#accounts">♙ <span>Users</span></a><a href="#reports">◔ <span>Reports</span></a><a href="#announcements">⚙ <span>Settings</span></a><a href="#disputes">? <span>Help &amp; Support</span></a></nav><div className="admin-sidebar-promo"><strong>Better rentals.<br />Happier journeys.</strong><span>Manage. Grow. Make it better.</span><Link href="#reports">View platform reports ↗</Link></div></aside><div className="admin-dashboard-content"><section className="admin-welcome-hero"><div><span className="eyebrow">GOOD TO SEE YOU, ADMIN</span><h1>Welcome back!</h1><p>Here’s what’s happening with Sheggar Wheels today.</p></div><div className="admin-date-tag">▣ {reportDate ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(reportDate) : "Updating…"}</div></section><section id="overview" className="admin-overview-section"><div className="admin-section-heading"><div><span className="eyebrow">YOUR PLATFORM AT A GLANCE</span><h2>Today’s overview</h2><p>Live totals from listings, accounts, and bookings.</p></div><span className="admin-updated-tag">● Dashboard active</span></div><div className="admin-metrics">{metrics.map(([label,value,detail,icon],index)=><article className={`admin-metric-card admin-metric-card-${index%4}`} key={label}><span className="admin-metric-icon">{icon}</span><span className="eyebrow">{label}</span><p className="admin-metric-value">{value}</p><small>{detail}</small></article>)}</div><div className="admin-report-charts admin-distribution-charts"><article className="admin-chart-card"><div className="admin-chart-heading"><div><h3>Booking status overview</h3><p>Distribution across all reservations</p></div><span>ALL TIME</span></div>{bookingDistribution.length?<div className="admin-donut-wrap"><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={bookingDistribution} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none" isAnimationActive animationDuration={1100}>{bookingDistribution.map((entry,index)=><Cell key={entry.name} fill={CHART_COLORS[index%CHART_COLORS.length]}/>)}</Pie><Tooltip/><Legend verticalAlign="bottom" height={34}/></PieChart></ResponsiveContainer><div className="admin-donut-center"><strong>{state.bookings.length}</strong><small>total bookings</small></div></div>:<p className="admin-chart-empty">Booking status data will appear here.</p>}</article><article className="admin-chart-card"><div className="admin-chart-heading"><div><h3>Bookings trend</h3><p>Booking requests · last six months</p></div><span>6 MONTHS</span></div><div className="admin-overview-line-chart" role="img" aria-label="Monthly booking request trend"><ResponsiveContainer width="100%" height={250} minWidth={0} style={{ width: "100%", height: "250px" }}><LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -18, bottom: 2 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eee9"/><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#73817a", fontSize: 9 }}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#73817a", fontSize: 9 }}/><Tooltip/><Line type="monotone" dataKey="bookings" name="Bookings" stroke="#217766" strokeWidth={3} dot={{ r: 3, fill: "#217766" }} activeDot={{ r: 5 }} isAnimationActive animationDuration={1000}/></LineChart></ResponsiveContainer></div></article></div></section>

        <aside className="admin-overview-rail" aria-label="Admin shortcuts and updates">
          <section className="admin-quick-actions"><span className="admin-quick-symbol">🚘</span><h2>Quick actions</h2><p>Manage your platform with ease.</p><Link href="#listings">▣ <span>Review car listings</span><b>›</b></Link><Link href="#bookings">▤ <span>View all bookings</span><b>›</b></Link><Link href="#accounts">♙ <span>Manage users</span><b>›</b></Link><Link href="#reports">▥ <span>View reports</span><b>›</b></Link></section>
          <section className="admin-rail-card"><div className="admin-rail-heading"><h2>Recent activity</h2><a href="#bookings">View all ↗</a></div>{recentActivity.length ? <div className="admin-activity-list">{recentActivity.map((item) => <article className="admin-activity-item" key={item.id}><span className="admin-activity-icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.detail}</small><small>{formatActivityDate(item.date)}</small></span></article>)}</div> : <p className="admin-rail-empty">Platform activity will appear here.</p>}</section>
          <section className="admin-rail-card"><div className="admin-rail-heading"><h2>Upcoming bookings</h2><a href="#bookings">Calendar ↗</a></div>{upcomingBookings.length ? <div className="admin-upcoming-list">{upcomingBookings.map((booking) => { const car = state.cars.find((item) => item.id === booking.carId); const renter = state.users.find((item) => item.id === booking.renterId); return <article key={booking.id}><span className="admin-upcoming-date">{formatActivityDate(booking.startDate)}</span><span><strong>{car ? `${car.make} ${car.model}` : "Confirmed rental"}</strong><small>{renter?.name || "Renter"} · {booking.startDate} – {booking.endDate}</small></span></article>; })}</div> : <p className="admin-rail-empty">No confirmed future rentals yet.</p>}</section>
        </aside>

        <section id="listings" className="details-panel milestone-panel admin-feature-section"><span className="admin-section-kicker">CONTENT MODERATION</span><h2>Owner listings awaiting moderation</h2><p>Approved listings are public; rejected listings keep the moderator reason.</p>{state.pendingCars.length === 0 ? <p>No pending car listings right now.</p> : <div className="admin-dispute-list">{state.pendingCars.map((car) => <article key={car.id}><span className="eyebrow">PENDING REVIEW · {car.location}</span><h3>{car.year} {car.make} {car.model}</h3><p>{car.description}</p><p><strong>Owner:</strong> {state.users.find((user) => user.id === car.ownerId)?.name ?? car.ownerId} · <strong>Daily price:</strong> {formatPrice(car.pricePerDay)} · <strong>Seats:</strong> {car.seats}</p><div className="admin-row-actions"><button className="button button-primary" type="button" onClick={() => handleApproveListing(car.id)}>Approve listing</button><form className="admin-reject-form" onSubmit={(event) => handleRejectListing(event, car.id)}><label className="sr-only" htmlFor={`reject-${car.id}`}>Reason for rejecting {car.make} {car.model}</label><input id={`reject-${car.id}`} name="reason" minLength={3} maxLength={500} placeholder="Reason for rejection" required /><button className="button button-dark" type="submit">Reject listing</button></form></div></article>)}</div>}</section>

        <section id="accounts" className="details-panel milestone-panel admin-feature-section"><span className="admin-section-kicker">ACCESS CONTROL</span><div className="admin-section-heading"><div><h2>Demo account management</h2><p>Suspending an owner hides their listings until reinstatement.</p></div></div><div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Action</th></tr></thead><tbody>{state.users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{(user.roles || []).map(formatStatus).join(", ")}</td><td><span className={`admin-status admin-status-${user.status}`}>{formatStatus(user.status)}</span></td><td>{user.id === state.user.id && user.status === "active" ? <span>Current admin</span> : <button className={`button ${user.status === "active" ? "button-dark" : "button-primary"}`} type="button" onClick={() => handleUserStatus(user, user.status === "active" ? "suspended" : "active")}>{user.status === "active" ? "Suspend" : "Reinstate"}</button>}</td></tr>)}</tbody></table></div></section>

        <section id="bookings" className="details-panel milestone-panel admin-feature-section"><span className="admin-section-kicker">RESERVATION ACTIVITY</span><div className="admin-section-heading"><div><h2>All platform bookings</h2><p>Review renter, owner, dates, current state, and recorded mock commission.</p></div><button className="button button-primary" type="button" onClick={handleExport}>Export platform report CSV</button></div><div className="admin-booking-status-tabs" role="group" aria-label="Filter bookings by status">{["", ...[...new Set(state.bookings.map((booking) => booking.status))].sort()].map((status) => <button type="button" key={status || "all"} className={bookingStatus === status ? "active" : ""} aria-pressed={bookingStatus === status} onClick={() => setBookingStatus(status)}>{status ? formatStatus(status) : "All"}<span>{status ? state.bookings.filter((booking) => booking.status === status).length : state.bookings.length}</span></button>)}</div><div className="admin-booking-filters"><label>Search booking, renter, owner, or car<input type="search" value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} placeholder="Search records" /></label></div><div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Booking</th><th>Car</th><th>Renter</th><th>Owner</th><th>Dates</th><th>Status</th><th>Total</th><th>Commission</th></tr></thead><tbody>{visibleBookings.map((booking) => { const car = state.cars.find((item) => item.id === booking.carId); const renter = state.users.find((item) => item.id === booking.renterId); const owner = state.users.find((item) => item.id === booking.ownerId); return <tr key={booking.id}><td>{booking.id}</td><td>{car ? `${car.year} ${car.make} ${car.model}` : booking.carId}</td><td>{renter?.name || booking.renterId}</td><td>{owner?.name || booking.ownerId}</td><td>{booking.startDate} – {booking.endDate}</td><td><span className={`admin-status admin-status-${booking.status}`}>{formatStatus(booking.status)}</span></td><td>{formatPrice(booking.total || 0)}</td><td>{formatPrice(booking.fee || 0)}</td></tr>; })}</tbody></table>{visibleBookings.length === 0 && <p className="owner-no-listings">No bookings match this filter.</p>}</div></section>

        <section id="reports" className="details-panel milestone-panel admin-feature-section"><span className="admin-section-kicker">PERFORMANCE</span><h2>Monthly bookings and mock commission</h2><p>Commission is summed from each booking’s saved fee snapshot. Current demo bookings have a zero fee, so reported commission may be ETB 0.</p><div className="admin-report-charts"><div><h3>Booking volume · last six months</h3><div className="admin-chart" role="img" aria-label="Monthly booking volume bar chart"><ResponsiveContainer width="100%" height={250}><BarChart data={monthlyData} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeae4" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#77716a", fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#77716a", fontSize: 10 }} /><Tooltip /><Bar dataKey="bookings" name="Bookings" fill="#2b8977" radius={[5, 5, 0, 0]} maxBarSize={45} isAnimationActive animationDuration={900} /></BarChart></ResponsiveContainer></div></div><div><h3>Recorded commission · ETB</h3><div className="admin-chart" role="img" aria-label="Monthly mock commission line chart"><ResponsiveContainer width="100%" height={250}><LineChart data={monthlyData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeae4" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#77716a", fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#77716a", fontSize: 10 }} /><Tooltip formatter={(value) => [formatPrice(value), "Recorded commission"]} /><Line type="monotone" dataKey="commission" name="Mock commission" stroke="#d45c37" strokeWidth={3} dot={{ r: 4 }} isAnimationActive animationDuration={1000} /></LineChart></ResponsiveContainer></div></div></div><div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Month</th><th>Bookings</th><th>Mock commission</th></tr></thead><tbody>{monthlyData.map((item) => <tr key={item.key}><td>{item.month}</td><td>{item.bookings}</td><td>{formatPrice(item.commission)}</td></tr>)}</tbody></table></div><p className="admin-commission-total">All recorded bookings: {state.counts?.bookings ?? 0} · Total recorded commission: {formatPrice(state.bookings.reduce((sum, booking) => sum + (Number(booking.fee) || 0), 0))}</p></section>

        <section id="announcements" className="details-panel milestone-panel admin-feature-section"><span className="admin-section-kicker">COMMUNICATION</span><h2>Publish an announcement</h2><p>Announcements are visible to visitors on the home page for a chosen period.</p><form className="milestone-form" onSubmit={handleAnnouncement}><label>Title<input name="title" minLength={3} maxLength={100} required /></label><label>Message<textarea name="message" minLength={3} maxLength={1000} rows={3} required /></label><label>Display for<select name="durationDays" defaultValue="7"><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label><button className="button button-primary" type="submit">Publish announcement</button></form>{state.announcements.length > 0 && <ul className="admin-announcements">{state.announcements.map((item) => <li key={item.id}><strong>{item.title}</strong><p>{item.message}</p><small>Active for {item.durationDays || 1} day{(item.durationDays || 1) === 1 ? "" : "s"} · Expires {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "soon"}</small></li>)}</ul>}</section>
        <section id="disputes" className="details-panel milestone-panel admin-feature-section"><span className="admin-section-kicker">CUSTOMER CARE</span><h2>Reported issues</h2>{state.disputes.length === 0 ? <p>No issues have been reported.</p> : <div className="admin-dispute-list">{state.disputes.map((dispute) => <article key={dispute.id}><span className="eyebrow">{dispute.status.toUpperCase()} · BOOKING {dispute.bookingId}</span><p>{dispute.reason}</p>{dispute.resolution ? <p><strong>Resolution:</strong> {dispute.resolution}</p> : dispute.status === "open" && <form className="milestone-form" onSubmit={(event) => handleResolve(event, dispute.id)}><label>Resolution<textarea name="resolution" minLength={3} maxLength={1000} rows={2} required /></label><button className="button button-primary" type="submit">Resolve issue</button></form>}</article>)}</div>}</section>
        <Link className="button button-dark" href="/cars">View public catalogue <span aria-hidden="true">↗</span></Link></div></div>
      </>}
    </section></main>
  </>;
}

export default function AdminDashboardPage() {
  return <AdminDashboardContent />;
}
