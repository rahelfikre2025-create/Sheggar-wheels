"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CarSearch() {
  const router = useRouter();
  const [location, setLocation] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (location.trim()) query.set("q", location.trim());
    router.push(`/cars${query.size ? `?${query.toString()}` : ""}`);
  }

  return (
    <form className="search-panel" onSubmit={handleSubmit}>
      <div className="search-field search-location"><label htmlFor="search-location">Where</label><div className="search-input-wrap"><span aria-hidden="true">⌖</span><input id="search-location" name="location" placeholder="Addis Ababa" value={location} onChange={(event) => setLocation(event.target.value)} /></div></div>
      <div className="search-field"><label htmlFor="pickup-date">Pick-up</label><div className="search-input-wrap"><span aria-hidden="true">▦</span><input id="pickup-date" name="pickup" type="date" /></div></div>
      <div className="search-field"><label htmlFor="return-date">Return</label><div className="search-input-wrap"><span aria-hidden="true">▦</span><input id="return-date" name="return" type="date" /></div></div>
      <button className="button button-primary search-button" type="submit">Find a car <span aria-hidden="true">↗</span></button>
    </form>
  );
}
