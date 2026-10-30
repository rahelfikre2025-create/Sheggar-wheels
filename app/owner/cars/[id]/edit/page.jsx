"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { getCurrentSession, hasRole } from "@/app/lib/session";
import {
  getCars,
  initializeDemoData,
  STORAGE_KEYS,
  writeStorage,
} from "@/app/lib/storage";

const inputStyle = {
  width: "100%",
  minHeight: "42px",
  padding: "9px 11px",
  border: "1px solid #e9e5df",
  borderRadius: "5px",
  color: "#38342f",
  background: "#fff",
  fontSize: "12px",
};

function toForm(car) {
  return {
    make: car.make ?? "",
    model: car.model ?? "",
    year: String(car.year ?? ""),
    location: car.location ?? "",
    neighbourhood: car.neighbourhood ?? "",
    transmission: car.transmission ?? "Automatic",
    seats: String(car.seats ?? "5"),
    fuelType: car.fuelType ?? "Petrol",
    pricePerDay: String(car.pricePerDay ?? ""),
    image: car.image ?? car.photos?.[0] ?? "",
    imageAlt: car.imageAlt ?? "",
    description: car.description ?? "",
  };
}

function validateForm(form) {
  const requiredFields = [
    ["make", "Enter the car make."],
    ["model", "Enter the car model."],
    ["year", "Enter the car year."],
    ["location", "Enter the car location."],
    ["neighbourhood", "Enter the neighbourhood."],
    ["transmission", "Choose the transmission type."],
    ["seats", "Enter the number of seats."],
    ["fuelType", "Enter the fuel type."],
    ["pricePerDay", "Enter the daily rental price."],
    ["description", "Enter a description for the listing."],
  ];

  for (const [field, message] of requiredFields) {
    if (!String(form[field] ?? "").trim()) return message;
  }

  const year = Number(form.year);
  const seats = Number(form.seats);
  const price = Number(form.pricePerDay);

  if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
    return "Enter a valid model year.";
  }

  if (!Number.isInteger(seats) || seats < 1) {
    return "Seats must be a whole number greater than zero.";
  }

  if (!Number.isFinite(price) || price <= 0) {
    return "Daily price must be greater than zero.";
  }

  return "";
}

function EditOwnerCarContent() {
  const { id: carId } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initialized = initializeDemoData();

    if (!initialized.ok) {
      setError(initialized.error);
      setLoading(false);
      return;
    }

    const currentUser = getCurrentSession();

    if (!currentUser || currentUser.status !== "active" || !hasRole(currentUser, "owner")) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Verify ownership when loading. Changing the URL ID cannot expose another owner's car.
    const car = getCars().find(
      (item) => item.id === carId && item.ownerId === currentUser.id
    );

    if (!car) {
      setUser(currentUser);
      setError("This car is unavailable or does not belong to your account.");
      setLoading(false);
      return;
    }

    if (car.status === "approved") {
      setUser(currentUser);
      setError("This listing has been approved and published. Owners cannot edit it after admin approval.");
      setLoading(false);
      return;
    }

    setUser(currentUser);
    setForm(toForm(car));
    setLoading(false);
  }, [carId]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    // Recheck the current session, role, and ownership immediately before writing.
    const currentUser = getCurrentSession();

    if (!currentUser || currentUser.status !== "active" || !hasRole(currentUser, "owner")) {
      setUser(null);
      setError("Sign in with an active owner account to edit this listing.");
      return;
    }

    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const latestCars = getCars();
    const existingCar = latestCars.find((item) => item.id === carId);

    if (!existingCar || existingCar.ownerId !== currentUser.id) {
      setError("This car is unavailable or does not belong to your account.");
      return;
    }

    if (existingCar.status === "approved") {
      setError("This listing was approved while you were editing. Published listings cannot be changed.");
      setForm(null);
      return;
    }

    setSaving(true);

    const updatedCar = {
      ...existingCar,
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      location: form.location.trim(),
      neighbourhood: form.neighbourhood.trim(),
      city: existingCar.city ?? "Addis Ababa",
      transmission: form.transmission,
      seats: Number(form.seats),
      fuelType: form.fuelType.trim(),
      pricePerDay: Number(form.pricePerDay),
      image: form.image.trim() || existingCar.image || existingCar.photos?.[0] || "",
      imageAlt: form.imageAlt.trim() || `${form.year} ${form.make} ${form.model}`,
      photos: form.image.trim() ? [form.image.trim()] : existingCar.photos ?? [],
      description: form.description.trim(),
      // Preserve moderation state; owners cannot approve their own listings.
      status: existingCar.status,
      updatedAt: new Date().toISOString(),
    };

    const updatedCars = latestCars.map((car) =>
      car.id === existingCar.id ? updatedCar : car
    );

    const result = writeStorage(STORAGE_KEYS.cars, updatedCars);
    setSaving(false);

    if (!result.ok) {
      setError(result.error || "Could not save your listing changes.");
      return;
    }

    router.push("/owner/cars");
    router.refresh();
  }

  return (
    <>
      <SiteHeader />
      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          <Link className="back-link" href="/owner/cars">
            <span aria-hidden="true">←</span> My cars
          </Link>

          <div className="catalogue-title">
            <div>
              <span className="eyebrow">OWNER TOOLS</span>
              <h1>Edit car listing.</h1>
              <p>Update a listing while it is waiting for admin approval. Approved listings are locked.</p>
            </div>
            <span className="catalogue-demo-tag"><span aria-hidden="true" /> PENDING LISTING</span>
          </div>

          {loading ? (
            <p className="catalogue-loading" role="status">Loading car listing…</p>
          ) : !user ? (
            <div className="empty-state">
              <h2>Owner sign-in required</h2>
              <p>Sign in with an active owner account to edit a listing.</p>
              <Link className="button button-primary" href={`/signin?next=${encodeURIComponent(`/owner/cars/${carId}/edit`)}`}>
                Sign in <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : error && !form ? (
            <div className="empty-state">
              <h2>Listing unavailable</h2>
              <p>{error}</p>
              <Link className="button button-primary" href="/owner/cars">
                Back to my cars <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : form ? (
            <form className="catalogue-controls" onSubmit={handleSubmit} noValidate>
              {error && (
                <p role="alert" style={{ margin: "0 0 16px", color: "#a13f3c", fontSize: "12px" }}>
                  {error}
                </p>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "15px" }}>
                <label className="filter-control"><span>Make *</span><input style={inputStyle} name="make" value={form.make} onChange={updateField} required /></label>
                <label className="filter-control"><span>Model *</span><input style={inputStyle} name="model" value={form.model} onChange={updateField} required /></label>
                <label className="filter-control"><span>Year *</span><input style={inputStyle} name="year" type="number" min="1950" max={new Date().getFullYear() + 1} value={form.year} onChange={updateField} required /></label>
                <label className="filter-control"><span>Neighbourhood *</span><input style={inputStyle} name="neighbourhood" value={form.neighbourhood} onChange={updateField} required /></label>
                <label className="filter-control"><span>Location *</span><input style={inputStyle} name="location" value={form.location} onChange={updateField} required /></label>
                <label className="filter-control"><span>Transmission *</span><select style={inputStyle} name="transmission" value={form.transmission} onChange={updateField} required><option value="Automatic">Automatic</option><option value="Manual">Manual</option></select></label>
                <label className="filter-control"><span>Seats *</span><input style={inputStyle} name="seats" type="number" min="1" step="1" value={form.seats} onChange={updateField} required /></label>
                <label className="filter-control"><span>Fuel type *</span><input style={inputStyle} name="fuelType" value={form.fuelType} onChange={updateField} required /></label>
                <label className="filter-control"><span>Price per day (ETB) *</span><input style={inputStyle} name="pricePerDay" type="number" min="1" step="1" value={form.pricePerDay} onChange={updateField} required /></label>
                <label className="filter-control"><span>Photo URL</span><input style={inputStyle} name="image" type="url" value={form.image} onChange={updateField} placeholder="https://…" /></label>
                <label className="filter-control"><span>Photo description</span><input style={inputStyle} name="imageAlt" value={form.imageAlt} onChange={updateField} placeholder="Blue sedan parked outside" /></label>
                <label className="filter-control" style={{ gridColumn: "1 / -1" }}><span>Description *</span><textarea style={{ ...inputStyle, minHeight: "110px", resize: "vertical" }} name="description" value={form.description} onChange={updateField} required /></label>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "18px" }}>
                <button className="button button-primary" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"} <span aria-hidden="true">↗</span>
                </button>
                <Link className="button button-dark" href="/owner/cars">Cancel</Link>
              </div>
            </form>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

export default function EditOwnerCarPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader />
          <main className="catalogue-main">
            <section className="page-width catalogue-layout">
              <p className="catalogue-loading" role="status">
                Loading car listing…
              </p>
            </section>
          </main>
          <SiteFooter />
        </>
      }
    >
      <EditOwnerCarContent />
    </Suspense>
  );
}
