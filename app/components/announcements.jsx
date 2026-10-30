"use client";

import { useEffect, useState } from "react";
import { getPublicAnnouncements } from "@/app/lib/milestones";

export default function Announcements() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const timer = window.setTimeout(() => setItems(getPublicAnnouncements()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!items.length) return null;
  return <section className="announcement-strip page-width" aria-label="Latest announcements">
    {items.slice().reverse().slice(0, 3).map((item) => <article key={item.id}><span className="eyebrow">SHEGGAR WHEELS UPDATE</span><h2>{item.title}</h2><p>{item.message}</p></article>)}
  </section>;
}
