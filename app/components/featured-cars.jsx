"use client";

import { useEffect, useState } from "react";
import CarCard from "@/app/components/car-card";
import { getCars, initializeDemoData } from "@/app/lib/storage";

export default function FeaturedCars() {
  const [cars, setCars] = useState([]);

  useEffect(() => {
    function loadApprovedCars() {
      if (initializeDemoData().ok) {
        setCars(getCars().filter((car) => car.status === "approved").slice(0, 3));
      }
    }

    loadApprovedCars();
    window.addEventListener("storage", loadApprovedCars);
    return () => window.removeEventListener("storage", loadApprovedCars);
  }, []);

  return cars.length ? (
    <div className="car-grid featured-grid">
      {cars.map((car) => <CarCard key={car.id} car={car} />)}
    </div>
  ) : (
    <p className="demo-note">Newly approved listings will appear here.</p>
  );
}
