"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import { getCars, initializeDemoData } from "@/app/lib/storage";
import { formatPrice } from "@/app/lib/data/cars";

export default function OwnerCarsPage() {
  const [state, setState] = useState({
    loading: true,
    user: null,
    cars: [],
    error: "",
  });

  useEffect(() => {
    const initialized = initializeDemoData();

    if (!initialized.ok) {
      setState({ loading: false, user: null, cars: [], error: initialized.error });
      return;
    }

    const user = getCurrentSession();

    if (!user) {
      setState({ loading: false, user: null, cars: [], error: "" });
      return;
    }

    if (!hasRole(user, "owner")) {
      setState({
        loading: false,
        user,
        cars: [],
        error: "Only owner accounts can view owner listings.",
      });
      return;
    }

    // Filter by owner ID so this page only shows the signed-in owner's cars.
    const cars = getCars().filter((car) => car.ownerId === user.id);

    setState({ loading: false, user, cars, error: "" });
  }, []);

  return (
    <>
      <SiteHeader />

      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          <Link className="back-link" href="/owner">
            <span aria-hidden="true">←</span> Owner dashboard
          </Link>

          <div className="catalogue-title">
            <div>
              <span className="eyebrow">OWNER TOOLS</span>
              <h1>My cars.</h1>
              <p>Manage your listings and track their review status.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <Link className="button button-primary" href="/owner/cars/new">Add a car <span aria-hidden="true">↗</span></Link>
              <span className="catalogue-demo-tag"><span aria-hidden="true" /> OWNER ACCOUNT</span>
            </div>
          </div>

          {state.loading ? (
            <p className="catalogue-loading" role="status">
              Loading your cars…
            </p>
          ) : !state.user ? (
            <div className="empty-state">
              <h2>Sign in as an owner.</h2>
              <p>Sign in to view and manage your listings.</p>
              <Link
                className="button button-primary"
                href="/signin?next=%2Fowner%2Fcars"
              >
                Sign in <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : state.error ? (
            <div className="empty-state">
              <h2>Listings unavailable</h2>
              <p>{state.error}</p>
              <Link className="button button-primary" href="/owner">
                Owner dashboard <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : state.cars.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">⌕</span>
              <h2>No cars are assigned to this owner.</h2>
              <p>Add your car details and submit the listing for admin approval.</p>
              <Link className="button button-primary" href="/owner/cars/new">Add your first car <span aria-hidden="true">↗</span></Link>
            </div>
          ) : (
            <>
              <div className="results-row">
                <p>
                  <strong>{state.cars.length}</strong>{" "}
                  {state.cars.length === 1 ? "car" : "cars"} owned by you
                </p>
                <Link className="text-link" href="/owner">
                  Owner dashboard <span aria-hidden="true">↗</span>
                </Link>
              </div>

              <div className="car-grid">
                {state.cars.map((car) => (
                  <article className="car-card" key={car.id}>
                    <div className="car-card-body">
                      <p className="car-year">
                        {car.year} · {car.location ?? car.neighbourhood}
                      </p>
                      <h2 style={{ margin: "7px 0", fontSize: "18px" }}>
                        {car.make} {car.model}
                      </h2>

                      <div className="car-specs">
                        <span>{car.transmission}</span>
                        <span>{car.seats} seats</span>
                      </div>

                      <p className="car-price" style={{ marginTop: "14px" }}>
                        <strong>{formatPrice(car.pricePerDay)}</strong>
                        <span> / day</span>
                      </p>

                      <p className="demo-note">
                        Listing status: {car.status ?? "not set"}. {car.status === "approved" ? "Published in the catalogue; edits are locked after approval." : "You can edit this listing while it is waiting for admin approval."}
                      </p>

                      {car.status !== "approved" && <Link className="button button-dark" style={{ width: "100%", marginTop: "12px" }} href={`/owner/cars/${car.id}/edit`}>Edit pending listing <span aria-hidden="true">↗</span></Link>}

                      <Link
                        className="button button-primary"
                        style={{ width: "100%", marginTop: "12px" }}
                        href={`/owner/cars/${car.id}/bookings`}
                      >
                        View booking requests <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
