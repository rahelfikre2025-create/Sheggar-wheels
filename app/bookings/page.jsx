"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import {
  getBookings,
  getCars,
  initializeDemoData,
} from "@/app/lib/storage";
import { formatPrice } from "@/app/lib/data/cars";
import { exportRowsToCsv } from "@/app/lib/milestones";

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
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const BOOKING_STATUS_ORDER = [
  "pending", "requested", "approved", "payment_submitted", "confirmed",
  "in_progress", "completed", "disputed", "resolved", "declined", "cancelled",
];

function statusDescription(status) {
  return ({
    pending: "Waiting for the owner to review these requests.",
    requested: "Waiting for the owner to review these requests.",
    approved: "Approved by the owner. Follow the owner instructions to continue.",
    payment_submitted: "Your simulated payment reference is waiting for owner verification.",
    confirmed: "The owner verified payment and confirmed these rentals.",
    in_progress: "These rentals are currently in progress.",
    completed: "These rentals are complete.",
    declined: "The owner declined these requests.",
    cancelled: "These bookings were cancelled.",
    disputed: "These bookings have an open issue.",
    resolved: "These booking issues have been resolved.",
  })[status] || "Your bookings with this status.";
}

function statusStyle(status) {
  if (["confirmed", "completed"].includes(status)) {
    return { color: "#174638", background: "#eaf4f1" };
  }

  if (["pending", "approved", "payment_submitted", "requested", "in_progress"].includes(status)) {
    return { color: "#78501a", background: "#fff4df" };
  }

  if (["cancelled", "declined"].includes(status)) {
    return { color: "#8b2e24", background: "#fff0ed" };
  }

  return { color: "#5d5954", background: "#f1efec" };
}

function BookingCard({ booking, car }) {
  const carName = car
    ? `${car.year} ${car.make} ${car.model}`
    : "Car listing";

  return (
    <article className="car-card">
      <div className="car-card-body">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="car-year">BOOKING</p>
            <h2 style={{ margin: "7px 0", fontSize: "18px" }}>{carName}</h2>
            <p style={{ margin: 0, color: "#77716a", fontSize: "11px" }}>
              {car?.location ?? "Location unavailable"}
            </p>
          </div>

          <span
            style={{
              ...statusStyle(booking.status),
              padding: "6px 9px",
              borderRadius: "20px",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            {formatStatus(booking.status)}
          </span>
        </div>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))",
            gap: "14px",
            margin: "18px 0 0",
          }}
        >
          <div>
            <dt style={{ color: "#817b74", fontSize: "10px" }}>Pick-up</dt>
            <dd style={{ margin: "5px 0 0", fontSize: "12px", fontWeight: 650 }}>
              {formatDate(booking.startDate)}
            </dd>
          </div>

          <div>
            <dt style={{ color: "#817b74", fontSize: "10px" }}>Return</dt>
            <dd style={{ margin: "5px 0 0", fontSize: "12px", fontWeight: 650 }}>
              {formatDate(booking.endDate)}
            </dd>
          </div>

          <div>
            <dt style={{ color: "#817b74", fontSize: "10px" }}>Duration</dt>
            <dd style={{ margin: "5px 0 0", fontSize: "12px", fontWeight: 650 }}>
              {booking.days} {booking.days === 1 ? "day" : "days"}
            </dd>
          </div>

          <div>
            <dt style={{ color: "#817b74", fontSize: "10px" }}>Total</dt>
            <dd style={{ margin: "5px 0 0", fontSize: "12px", fontWeight: 700 }}>
              {formatPrice(booking.total ?? 0)}
            </dd>
          </div>
        </dl>

        <p className="demo-note" style={{ marginTop: "15px" }}>
          Booking ID: {booking.id}
        </p>
        {booking.status === "approved" && (
          <div className="request-info" role="status" style={{ marginTop: 12 }}>
            <strong>Booking request approved</strong>
            <p>{booking.paymentInstructions
              ? `Owner instructions (${booking.paymentInstructions.method === "telebirr" ? "Demo TeleBirr" : "Bank transfer"}): ${booking.paymentInstructions.details}`
              : "The owner will add payment instructions before checkout is available."}</p>
            {booking.paymentInstructions && <Link className="button button-primary" href={`/bookings/${booking.id}`}>Continue to checkout <span aria-hidden="true">↗</span></Link>}
          </div>
        )}
        {booking.status === "payment_submitted" && (
          <div className="request-info" role="status" style={{ marginTop: 12 }}>
            <strong>Payment reference submitted</strong>
            <p>The owner must verify it before the rental is confirmed.</p>
          </div>
        )}
        <Link className="text-link" href={`/bookings/${booking.id}`}>View booking details <span aria-hidden="true">↗</span></Link>
      </div>
    </article>
  );
}

function matchesFilters(booking, car, filters) {
  const search = filters.search.trim().toLocaleLowerCase();
  const description = `${booking.id} ${car?.make || ""} ${car?.model || ""} ${car?.location || ""}`.toLocaleLowerCase();
  return (!search || description.includes(search))
    && (!filters.status || booking.status === filters.status)
    && (!filters.carId || booking.carId === filters.carId)
    && (!filters.from || booking.endDate >= filters.from)
    && (!filters.to || booking.startDate <= filters.to);
}

export default function BookingsPage() {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    user: null,
    cars: [],
    bookings: [],
    error: "",
  });
  const [filters, setFilters] = useState({ search: "", status: "", carId: "", from: "", to: "" });
  const [feedback, setFeedback] = useState("");
  const [approvalNotice, setApprovalNotice] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState("unsupported");
  const previousStatusesRef = useRef(new Map());

  useEffect(() => {
    const initResult = initializeDemoData();

    if (!initResult.ok) {
      setState({
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
      setState({
        loading: false,
        user: null,
        cars: [],
        bookings: [],
        error: "",
      });
      return;
    }

    if (!hasRole(user, "renter")) {
      setState({
        loading: false,
        user,
        cars: [],
        bookings: [],
        error: "Booking history is available to renter accounts.",
      });
      return;
    }

    const bookings = getBookings()
      .filter((booking) => booking.renterId === user.id)
      .sort((a, b) => (a.startDate > b.startDate ? -1 : 1));
    previousStatusesRef.current = new Map(bookings.map((booking) => [booking.id, {
      status: booking.status,
      hasInstructions: Boolean(booking.paymentInstructions),
    }]));
    if ("Notification" in window) setNotificationPermission(window.Notification.permission);

    setState({
      loading: false,
      user,
      cars: getCars(),
      bookings,
      error: "",
    });

    const refreshBookings = () => {
      const currentUser = getCurrentSession();
      if (!currentUser || currentUser.id !== user.id || !hasRole(currentUser, "renter")) return;
      const refreshedBookings = getBookings().filter((booking) => booking.renterId === currentUser.id).sort((a, b) => (a.startDate > b.startDate ? -1 : 1));
      const changedBookings = refreshedBookings.flatMap((booking) => {
        const previous = previousStatusesRef.current.get(booking.id);
        const wasApproved = ["pending", "requested"].includes(previous?.status ?? previous);
        const newlyApproved = booking.status === "approved" && wasApproved;
        const instructionsAdded = booking.status === "approved" && Boolean(booking.paymentInstructions) && previous?.status === "approved" && !previous.hasInstructions;
        return newlyApproved || instructionsAdded ? [{ booking, instructionsAdded }] : [];
      });
      if (changedBookings.length) {
        const { booking: changedBooking, instructionsAdded } = changedBookings[0];
        const approvedCar = getCars().find((car) => car.id === changedBooking.carId);
        const carName = approvedCar ? `${approvedCar.year} ${approvedCar.make} ${approvedCar.model}` : "Your car booking";
        setApprovalNotice({ bookingId: changedBooking.id, carName, instructionsReady: Boolean(changedBooking.paymentInstructions) });
        if ("Notification" in window && window.Notification.permission === "granted") {
          try {
            const title = instructionsAdded ? "Payment instructions are ready" : "Booking request approved";
            const body = instructionsAdded
              ? `${carName} is approved and the owner has added payment instructions. Open the booking to continue to checkout.`
              : `${carName} is approved. The owner will add payment instructions before checkout is available.`;
            const browserNotification = new window.Notification(title, { body });
            browserNotification.onclick = () => { window.focus(); router.push(`/bookings/${changedBooking.id}`); };
          } catch {
            setFeedback("The owner approved your request. View your booking in My Trips to continue.");
          }
        }
      }
      previousStatusesRef.current = new Map(refreshedBookings.map((booking) => [booking.id, {
        status: booking.status,
        hasInstructions: Boolean(booking.paymentInstructions),
      }]));
      setState({
        loading: false,
        user: currentUser,
        cars: getCars(),
        bookings: refreshedBookings,
        error: "",
      });
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
  }, [router]);

  const filteredBookings = useMemo(() => state.bookings.filter((booking) =>
    matchesFilters(booking, state.cars.find((car) => car.id === booking.carId), filters)
  ), [state.bookings, state.cars, filters]);
  const groupedBookings = useMemo(() => {
    const statuses = [...new Set(filteredBookings.map((booking) => booking.status))].sort((a, b) => {
      const aIndex = BOOKING_STATUS_ORDER.indexOf(a);
      const bIndex = BOOKING_STATUS_ORDER.indexOf(b);
      return (aIndex < 0 ? BOOKING_STATUS_ORDER.length : aIndex) - (bIndex < 0 ? BOOKING_STATUS_ORDER.length : bIndex) || a.localeCompare(b);
    });
    return statuses.map((status) => ({
      status,
      bookings: filteredBookings.filter((booking) => booking.status === status),
    }));
  }, [filteredBookings]);

  function resetFilters() {
    setFilters({ search: "", status: "", carId: "", from: "", to: "" });
  }

  async function enableApprovalNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") setFeedback("Approval notifications are enabled for this browser.");
      else if (permission === "denied") setFeedback("Notifications are blocked by your browser. You can still follow updates in My Trips.");
    } catch {
      setFeedback("Your browser could not enable notifications. You can still follow updates in My Trips.");
    }
  }

  function handleExport() {
    const user = getCurrentSession();
    if (!state.user || !user || user.id !== state.user.id || !hasRole(user, "renter")) {
      setFeedback("Only the signed-in renter can export this booking history.");
      return;
    }
    const ownBookings = getBookings().filter((booking) => booking.renterId === user.id);
    const currentCars = getCars();
    const rows = ownBookings
      .filter((booking) => matchesFilters(booking, currentCars.find((car) => car.id === booking.carId), filters))
      .map((booking) => {
        const car = currentCars.find((item) => item.id === booking.carId);
        return [booking.id, car ? `${car.year} ${car.make} ${car.model}` : booking.carId, car?.location || "", booking.startDate, booking.endDate, booking.days, booking.pricePerDay, booking.subtotal, booking.fee, booking.total, booking.status, booking.paymentStatus || "unpaid"];
      });
    const result = exportRowsToCsv("sheggar-wheels-my-booking-history.csv", ["Booking ID", "Car", "Location", "Pick-up", "Return", "Rental days", "Daily price ETB", "Subtotal ETB", "Fee ETB", "Total ETB", "Status", "Payment status"], rows);
    setFeedback(result.ok ? `Exported ${rows.length} matching booking${rows.length === 1 ? "" : "s"}.` : result.error);
  }

  return (
    <>
      <SiteHeader />

      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          <div className="catalogue-title">
            <div>
              <span className="eyebrow">RENTER ACCOUNT</span>
              <h1>My bookings.</h1>
              <p>Review the status and details of your rental requests.</p>
            </div>

            <span className="catalogue-demo-tag">
              <span aria-hidden="true" />
              MY ACCOUNT
            </span>
          </div>

          {state.loading ? (
            <p className="catalogue-loading" role="status">
              Loading your bookings…
            </p>
          ) : state.error ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">!</span>
              <h2>Bookings unavailable</h2>
              <p>{state.error}</p>
              <Link className="button button-primary" href="/cars">
                Browse cars <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : !state.user ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">↗</span>
              <h2>Sign in to view your bookings.</h2>
              <p>Sign in with your renter account to see your booking history.</p>
              <Link
                className="button button-primary"
                href="/signin?next=%2Fbookings"
              >
                Continue to sign in <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : state.bookings.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">⌕</span>
              <h2>You have no bookings yet.</h2>
              <p>
                When you request a car, your booking and its status will appear
                here.
              </p>
              <Link className="button button-primary" href="/cars">
                Explore cars <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : (
            <>
              {approvalNotice && <div className="booking-approval-notice" role="status"><span aria-hidden="true">✓</span><div><strong>{approvalNotice.instructionsReady ? "Payment instructions are ready" : "Owner approved your request"}</strong><p>{approvalNotice.instructionsReady ? `${approvalNotice.carName} is ready for checkout.` : `${approvalNotice.carName} is approved. The owner will add payment instructions before checkout is available.`}</p></div><Link className="button button-primary" href={`/bookings/${approvalNotice.bookingId}`}>{approvalNotice.instructionsReady ? "Continue to checkout" : "View booking"} <span aria-hidden="true">↗</span></Link><button className="booking-notice-dismiss" type="button" aria-label="Dismiss approval notice" onClick={() => setApprovalNotice(null)}>×</button></div>}
              <div className="booking-notification-controls">{notificationPermission === "granted" ? <span role="status">✓ Browser approval notifications enabled</span> : notificationPermission === "denied" ? <span>Browser notifications are blocked; My Trips will still show updates.</span> : notificationPermission === "default" ? <><span>Get notified when an owner approves a request.</span><button className="text-link" type="button" onClick={enableApprovalNotifications}>Enable notifications</button></> : null}</div>
              <div className="results-row">
                <p>
                  <strong>{filteredBookings.length}</strong> of {state.bookings.length}{" "}
                  {state.bookings.length === 1 ? "booking" : "bookings"}
                </p>
                <div className="booking-history-actions"><button className="button button-primary" type="button" onClick={handleExport}>Export CSV</button><Link className="text-link" href="/dashboard">Back to dashboard <span aria-hidden="true">↗</span></Link></div>
              </div>

              {feedback && <p className="request-info" role="status">{feedback}</p>}

              <div className="booking-history-filters" aria-label="Filter booking history">
                <label>Search<input type="search" placeholder="Car name or booking ID" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></label>
                <label>Status<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{[...new Set(state.bookings.map((booking) => booking.status))].sort().map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
                <label>Car<select value={filters.carId} onChange={(event) => setFilters((current) => ({ ...current, carId: event.target.value }))}><option value="">All cars</option>{[...new Set(state.bookings.map((booking) => booking.carId))].map((carId) => { const car = state.cars.find((item) => item.id === carId); return <option key={carId} value={carId}>{car ? `${car.make} ${car.model}` : "Car listing"}</option>; })}</select></label>
                <label>From date<input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
                <label>To date<input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
                <button className="reset-filters" type="button" onClick={resetFilters} disabled={!filters.search && !filters.status && !filters.carId && !filters.from && !filters.to}>Clear filters</button>
              </div>

              {filteredBookings.length ? <div style={{ display: "grid", gap: "22px" }}>
                {groupedBookings.map(({ status, bookings }) => (
                  <section key={status} aria-labelledby={`booking-status-${status}`} style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div><h2 id={`booking-status-${status}`} style={{ margin: 0, fontSize: 18 }}>{formatStatus(status)} <span style={{ color: "#817b74", fontSize: 13 }}>({bookings.length})</span></h2><p style={{ margin: "5px 0 0", color: "#77716a", fontSize: 11 }}>{statusDescription(status)}</p></div>
                    </div>
                    <div style={{ display: "grid", gap: 14 }}>{bookings.map((booking) => <BookingCard key={booking.id} booking={booking} car={state.cars.find((item) => item.id === booking.carId)} />)}</div>
                  </section>
                ))}
              </div> : <div className="empty-state booking-filter-empty"><h2>No bookings match these filters.</h2><p>Adjust the selected filters or clear them to see your complete booking history.</p><button className="button button-primary" type="button" onClick={resetFilters}>Clear filters</button></div>}

              <p className="demo-note catalogue-demo-note">
                Your booking history will appear here.
              </p>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
