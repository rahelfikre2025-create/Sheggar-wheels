"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import RentalQuote from "@/app/components/rental-quote";
import { formatPrice } from "@/app/lib/data/cars";
import { getBookings, getCars, initializeDemoData } from "@/app/lib/storage";
import { isCarRentedOnDate } from "@/app/lib/bookings";
import { getReviews } from "@/app/lib/milestones";

function CarDetailsContent() {
  const { id } = useParams();
  const [car, setCar] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function loadApprovedCar() {
      if (initializeDemoData().ok) {
        const approvedCar = getCars().find((item) => item.id === id && item.status === "approved");
        const today = new Date();
        const date = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
        setCar(approvedCar ? { ...approvedCar, currentlyRented: isCarRentedOnDate(approvedCar.id, date, getBookings()) } : null);
        setReviews(approvedCar ? getReviews().filter((review) => review.carId === approvedCar.id) : []);
      }
      setLoading(false);
    }

    loadApprovedCar();
    window.addEventListener("storage", loadApprovedCar);
    window.addEventListener("sw-storage", loadApprovedCar);
    return () => {
      window.removeEventListener("storage", loadApprovedCar);
      window.removeEventListener("sw-storage", loadApprovedCar);
    };
  }, [id]);

  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0;

  return (
    <>
      <SiteHeader />
      <main className="details-main page-width">
        {loading ? (
          <p className="catalogue-loading" role="status">Loading approved car listing…</p>
        ) : !car ? (
          <section className="not-found-page">
            <span className="not-found-mark" aria-hidden="true">⌕</span>
            <span className="eyebrow">LISTING UNAVAILABLE</span>
            <h1>This car isn’t in the catalogue.</h1>
            <p>Listings appear here after an admin approves them.</p>
            <Link className="button button-primary" href="/cars">Browse approved cars <span aria-hidden="true">↗</span></Link>
          </section>
        ) : (
          <>
            <Link className="back-link" href="/cars"><span aria-hidden="true">←</span> Back to all cars</Link>
            <div className="details-layout">
              <div className="details-gallery">
                <div className="details-image-wrap"><Image src={car.image} alt={car.imageAlt || `${car.year} ${car.make} ${car.model}`} fill priority sizes="(max-width: 900px) 100vw, 65vw" /></div>
                <div className="details-image-caption"><span>CAR LISTING</span><span>Vehicle image</span></div>
                <div className="details-description"><span className="eyebrow">ABOUT THIS RIDE</span><h2>Made for your next trip.</h2><p>{car.description}</p></div>
              </div>
              <aside className="details-panel">
                <span className={"availability-note" + (car.currentlyRented ? " availability-rented" : "")}><span />{car.currentlyRented ? "Rented today" : "Available for rent"}</span>
                <p className="details-year">{car.year} · {car.location}</p>
                <h1>{car.make} {car.model}</h1>
                <p className="car-rating" aria-label={reviews.length ? `Rated ${averageRating.toFixed(1)} out of 5 from ${reviews.length} reviews` : "No reviews yet"}>
                  {reviews.length ? <><span aria-hidden="true">★</span> {averageRating.toFixed(1)} <span className="car-rating-count">({reviews.length} {reviews.length === 1 ? "review" : "reviews"})</span></> : <span className="car-rating-empty">No reviews yet</span>}
                </p>
                <p className="details-price"><strong>{formatPrice(car.pricePerDay)}</strong><span> / day</span></p>
                <div className="details-rule" />
                <dl className="details-specs">
                  <div><dt>Transmission</dt><dd>{car.transmission}</dd></div>
                  <div><dt>Seats</dt><dd>{car.seats} people</dd></div>
                  {car.fuelType && <div><dt>Fuel type</dt><dd>{car.fuelType}</dd></div>}
                  <div><dt>Location</dt><dd>{car.location}</dd></div>
                </dl>
                <RentalQuote car={car} />
              </aside>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

export default function CarDetailsPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader />
          <main className="details-main page-width">
            <p className="catalogue-loading" role="status">Loading car listing…</p>
          </main>
          <SiteFooter />
        </>
      }
    >
      <CarDetailsContent />
    </Suspense>
  );
}
