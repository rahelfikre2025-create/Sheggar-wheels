import Link from "next/link";

export default function CarNotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-mark" aria-hidden="true">?</div>
      <span className="eyebrow">WRONG TURN?</span>
      <h1>This car isn’t on the map.</h1>
      <p>We couldn’t find that listing. It may have moved, or the link may be incorrect.</p>
      <Link className="button button-primary" href="/cars">Explore all cars <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
