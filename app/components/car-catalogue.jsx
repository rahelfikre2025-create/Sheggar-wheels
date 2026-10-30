"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import LeafletMap from "@/app/components/leaflet-map";
import CarCard from "@/app/components/car-card";
import { getBookings, getCars, initializeDemoData } from "@/app/lib/storage";
import { datesOverlap, isBookingRentalReserved } from "@/app/lib/bookings";

const PAGE_SIZE = 6;
const neighbourhoodCoordinates = {
  Bole: [8.995, 38.787],
  Kazanchis: [9.020, 38.765],
  Megenagna: [9.039, 38.808],
  "Old Airport": [8.995, 38.760],
  CMC: [9.057, 38.818],
};

const FILTER_KEYS = [
  "q", "city", "neighbourhood", "min", "max", "transmission", "seats",
  "pickup", "return", "sort", "page",
];

function parseFilters(params) {
  const rawPage = Number.parseInt(params.get("page") || "1", 10);
  return {
    q: params.get("q") || "",
    city: params.get("city") || "",
    neighbourhood: params.get("neighbourhood") || "",
    min: params.get("min") || "",
    max: params.get("max") || "",
    transmission: params.get("transmission") || "",
    seats: params.get("seats") || "",
    pickup: params.get("pickup") || "",
    returnDate: params.get("return") || "",
    sort: params.get("sort") || "popular",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

function cityOf(car) {
  return car.city || car.location?.split(",").at(-1)?.trim() || "Addis Ababa";
}

function neighbourhoodOf(car) {
  return car.neighbourhood || car.location?.split(",")[0]?.trim() || "Other";
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function dateRangeError(pickup, returnDate) {
  if (!pickup && !returnDate) return "";
  if (!pickup || !returnDate) return "Choose both pick-up and return dates to check availability.";
  if (!isCalendarDate(pickup) || !isCalendarDate(returnDate) || returnDate <= pickup) {
    return "Return date must be later than pick-up date.";
  }
  return "";
}

function isAvailableForDates(car, pickup, returnDate, bookings) {
  const unavailable = Array.isArray(car.unavailableDates) && car.unavailableDates.some((item) => {
    if (typeof item === "string") return item >= pickup && item < returnDate;
    return item?.startDate && item?.endDate && datesOverlap(pickup, returnDate, item.startDate, item.endDate);
  });
  if (unavailable) return false;

  return !bookings.some((booking) =>
    booking.carId === car.id &&
    isBookingRentalReserved(booking) &&
    datesOverlap(pickup, returnDate, booking.startDate, booking.endDate)
  );
}

function CatalogueContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const paramsString = searchParams.toString();
  const [filters, setFilters] = useState(() => parseFilters(searchParams));
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loadingCars, setLoadingCars] = useState(true);

  useEffect(() => {
    setFilters(parseFilters(new URLSearchParams(paramsString)));
  }, [paramsString]);

  const loadApprovedCars = useCallback(() => {
    const initialized = initializeDemoData();
    if (initialized.ok) {
      setCars(getCars().filter((car) => car.status === "approved"));
      setBookings(getBookings());
    }
    setLoadingCars(false);
  }, []);

  useEffect(() => {
    loadApprovedCars();
    window.addEventListener("storage", loadApprovedCars);
    window.addEventListener("sw-storage", loadApprovedCars);
    window.addEventListener("focus", loadApprovedCars);
    return () => {
      window.removeEventListener("storage", loadApprovedCars);
      window.removeEventListener("sw-storage", loadApprovedCars);
      window.removeEventListener("focus", loadApprovedCars);
    };
  }, [loadApprovedCars]);

  const updateFilters = useCallback((changes) => {
    const next = { ...filters, ...changes };
    if (!(Object.keys(changes).length === 1 && "page" in changes)) next.page = 1;
    setFilters(next);
    const params = new URLSearchParams();
    FILTER_KEYS.forEach((key) => {
      const value = key === "return" ? next.returnDate : next[key];
      if (value && !(key === "page" && Number(value) === 1) && !(key === "sort" && value === "popular")) {
        params.set(key, String(value));
      }
    });
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

  const availableCities = useMemo(() => [...new Set(cars.map(cityOf))].sort((a, b) => a.localeCompare(b)), [cars]);
  const availableNeighbourhoods = useMemo(() => {
    const cityCars = filters.city ? cars.filter((car) => cityOf(car) === filters.city) : cars;
    return [...new Set(cityCars.map(neighbourhoodOf))].sort((a, b) => a.localeCompare(b));
  }, [cars, filters.city]);

  const rangeError = dateRangeError(filters.pickup, filters.returnDate);
  const sortedCars = useMemo(() => {
    const normalizedQuery = filters.q.trim().toLocaleLowerCase();
    const popularity = new Map();
    bookings.forEach((booking) => popularity.set(booking.carId, (popularity.get(booking.carId) || 0) + 1));

    const result = cars.filter((car) => {
      const searchableText = `${car.make || ""} ${car.model || ""} ${car.location || ""} ${car.description || ""}`.toLocaleLowerCase();
      return (!normalizedQuery || searchableText.includes(normalizedQuery))
        && (!filters.city || cityOf(car) === filters.city)
        && (!filters.neighbourhood || neighbourhoodOf(car) === filters.neighbourhood)
        && (!filters.min || Number(car.pricePerDay) >= Number(filters.min))
        && (!filters.max || Number(car.pricePerDay) <= Number(filters.max))
        && (!filters.transmission || car.transmission === filters.transmission)
        && (!filters.seats || Number(car.seats) >= Number(filters.seats))
        && (rangeError || !filters.pickup || !filters.returnDate || isAvailableForDates(car, filters.pickup, filters.returnDate, bookings));
    });

    result.sort((a, b) => {
      if (filters.sort === "price-asc") return Number(a.pricePerDay) - Number(b.pricePerDay);
      if (filters.sort === "price-desc") return Number(b.pricePerDay) - Number(a.pricePerDay);
      if (filters.sort === "newest") return new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0);
      return (popularity.get(b.id) || 0) - (popularity.get(a.id) || 0)
        || new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0);
    });
    return result;
  }, [cars, bookings, filters, rangeError]);

  const pageCount = Math.max(1, Math.ceil(sortedCars.length / PAGE_SIZE));
  const currentPage = Math.min(filters.page, pageCount);
  const pageCars = sortedCars.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (filters.page > pageCount) updateFilters({ page: pageCount });
  }, [filters.page, pageCount, updateFilters]);

  function resetFilters() {
    const empty = { q: "", city: "", neighbourhood: "", min: "", max: "", transmission: "", seats: "", pickup: "", returnDate: "", sort: "popular", page: 1 };
    setFilters(empty);
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = Boolean(filters.q || filters.city || filters.neighbourhood || filters.min || filters.max || filters.transmission || filters.seats || filters.pickup || filters.returnDate || filters.sort !== "popular");

  return (
    <div className="page-width catalogue-layout">
      <div className="catalogue-title">
        <div><span className="eyebrow">YOUR NEXT RIDE IS HERE</span><h1>Explore the cars.</h1><p>Find a local ride that fits your next Addis Ababa adventure.</p></div>
        <span className="catalogue-demo-tag"><span /> ADDIS ABABA LISTINGS</span>
      </div>
      <div className="catalogue-controls">
        <label className="catalogue-search" htmlFor="catalogue-search"><span aria-hidden="true">⌕</span><input id="catalogue-search" type="search" placeholder="Search make, model, or neighborhood" value={filters.q} onChange={(event) => updateFilters({ q: event.target.value })} /><span className="search-hint">⌘ K</span></label>
        <div className="filters-row">
          <label className="filter-control"><span>City</span><select value={filters.city} onChange={(event) => updateFilters({ city: event.target.value, neighbourhood: "" })}><option value="">Any city</option>{availableCities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
          <label className="filter-control"><span>Neighbourhood</span><select value={filters.neighbourhood} onChange={(event) => updateFilters({ neighbourhood: event.target.value })}><option value="">Any neighbourhood</option>{availableNeighbourhoods.map((place) => <option key={place} value={place}>{place}</option>)}</select></label>
          <label className="filter-control"><span>Min price <span className="sr-only">per day in ETB</span></span><span className="price-input-wrap"><span>ETB</span><input aria-label="Minimum daily price in ETB" inputMode="numeric" type="number" min="0" placeholder="Any" value={filters.min} onChange={(event) => updateFilters({ min: event.target.value })} /></span></label>
          <label className="filter-control"><span>Max price <span className="sr-only">per day in ETB</span></span><span className="price-input-wrap"><span>ETB</span><input aria-label="Maximum daily price in ETB" inputMode="numeric" type="number" min="0" placeholder="Any" value={filters.max} onChange={(event) => updateFilters({ max: event.target.value })} /></span></label>
          <label className="filter-control"><span>Transmission</span><select value={filters.transmission} onChange={(event) => updateFilters({ transmission: event.target.value })}><option value="">Any type</option><option value="Automatic">Automatic</option><option value="Manual">Manual</option></select></label>
          <label className="filter-control"><span>Seats</span><select value={filters.seats} onChange={(event) => updateFilters({ seats: event.target.value })}><option value="">Any seats</option><option value="5">5 or more</option><option value="7">7 or more</option></select></label>
          <label className="filter-control"><span>Pick-up date</span><input className="catalogue-date-input" type="date" value={filters.pickup} onChange={(event) => updateFilters({ pickup: event.target.value })} /></label>
          <label className="filter-control"><span>Return date</span><input className="catalogue-date-input" type="date" value={filters.returnDate} onChange={(event) => updateFilters({ returnDate: event.target.value })} /></label>
          <label className="filter-control"><span>Sort by</span><select value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value })}><option value="popular">Most popular</option><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>
          <button className="reset-filters" type="button" onClick={resetFilters} disabled={!hasFilters}>Reset filters <span aria-hidden="true">↺</span></button>
        </div>
        {rangeError && <p className="catalogue-filter-message" role="status">{rangeError}</p>}
        <p className="catalogue-filter-hint">Popularity is based on the number of booking requests. Current filters are saved in the page URL so you can share them.</p>
      </div>
      <div className="results-row"><p><strong>{loadingCars ? "…" : sortedCars.length}</strong> {sortedCars.length === 1 ? "car" : "cars"} to explore</p><span>All prices shown per day in ETB · Page {currentPage} of {pageCount}</span></div>
      <details className="catalogue-map-details">
        <summary>Show cars on the Addis Ababa map</summary>
        <p>Explore the neighborhoods where cars are available for pickup.</p>
        <LeafletMap className="catalogue-map leaflet-map" markers={sortedCars.map((car) => ({ id: car.id, position: neighbourhoodCoordinates[neighbourhoodOf(car)] ?? [9.03, 38.78], label: `${car.year} ${car.make} ${car.model} · ${neighbourhoodOf(car)}`, href: `/cars/${car.id}` }))} />
        <div className="catalogue-map-key">{sortedCars.map((car) => <Link key={car.id} href={`/cars/${car.id}`}>{car.make} {car.model} · {neighbourhoodOf(car)}</Link>)}</div>
      </details>
      {loadingCars ? (
        <p className="catalogue-loading" role="status">Loading approved listings…</p>
      ) : pageCars.length > 0 ? (
        <>
          <div className="car-grid catalogue-grid">{pageCars.map((car) => <CarCard key={car.id} car={car} />)}</div>
          {pageCount > 1 && <nav className="catalogue-pagination" aria-label="Car catalogue pages">
            <button type="button" className="catalogue-page-button" disabled={currentPage <= 1} onClick={() => updateFilters({ page: currentPage - 1 })}>Previous</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button key={page} type="button" className={`catalogue-page-button${currentPage === page ? " is-current" : ""}`} aria-current={currentPage === page ? "page" : undefined} onClick={() => updateFilters({ page })}>{page}</button>)}
            <button type="button" className="catalogue-page-button" disabled={currentPage >= pageCount} onClick={() => updateFilters({ page: currentPage + 1 })}>Next</button>
          </nav>}
        </>
      ) : (
        <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌕</span><h2>No cars found this time.</h2><p>Try a different search or clear your filters to see all available listings.</p><button className="button button-primary" type="button" onClick={resetFilters}>Reset filters <span aria-hidden="true">↺</span></button></div>
      )}
    </div>
  );
}

export default function CarCatalogue() {
  return <Suspense fallback={<div className="catalogue-loading page-width">Loading cars…</div>}><CatalogueContent /></Suspense>;
}
