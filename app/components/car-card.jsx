"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/app/lib/data/cars";
import { isCarRentedOnDate } from "@/app/lib/bookings";
import { getBookings } from "@/app/lib/storage";

function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export default function CarCard({ car }) {
  const [rented, setRented] = useState(false);

  useEffect(() => {
    function refreshAvailability() {
      setRented(isCarRentedOnDate(car.id, todayString(), getBookings()));
    }

    refreshAvailability();
    window.addEventListener("storage", refreshAvailability);
    window.addEventListener("sw-storage", refreshAvailability);
    return () => {
      window.removeEventListener("storage", refreshAvailability);
      window.removeEventListener("sw-storage", refreshAvailability);
    };
  }, [car.id]);

  return (
    <article className={`car-card${rented ? " car-card-rented" : ""}`}>
      <Link className="car-image-link" href={`/cars/${car.id}`} aria-label={`View ${car.year} ${car.make} ${car.model}`}>
        <Image src={car.image} alt={car.imageAlt} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        <span className={"car-image-badge" + (rented ? " car-image-badge-rented" : "")}>{rented ? "RENTED" : "AVAILABLE FOR RENT"}</span>
        <span className="card-image-arrow" aria-hidden="true">↗</span>
      </Link>
      <div className="car-card-body">
        <div className="car-card-heading">
          <div><p className="car-year">{car.year} · {car.location}</p><h3><Link href={`/cars/${car.id}`}>{car.make} {car.model}</Link></h3></div>
          <p className="car-price"><strong>{formatPrice(car.pricePerDay)}</strong><span>/ day</span></p>
        </div>
        <div className="car-specs"><span><span aria-hidden="true">↔</span> {car.transmission}</span><span><span aria-hidden="true">♙</span> {car.seats} seats</span></div>
        <div className="car-card-bottom"><span className={`availability-note${rented ? " availability-rented" : ""}`}><span /> {rented ? "Rented today" : "Available for rent"}</span><Link className="card-details-link" href={`/cars/${car.id}`}>View details <span aria-hidden="true">↗</span></Link></div>
      </div>
    </article>
  );
}
