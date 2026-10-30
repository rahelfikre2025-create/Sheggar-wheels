import Image from "next/image";
import Link from "next/link";
import FeaturedCars from "@/app/components/featured-cars";
import CarSearch from "@/app/components/car-search";
import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import Announcements from "@/app/components/announcements";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Announcements />
        <section className="hero-shell">
          <div className="hero-content page-width">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> YOUR CITY. YOUR NEXT DRIVE.</span>
              <h1>Find the right car <span>for your next journey.</span></h1>
              <p className="hero-description">
                Discover local cars for every Addis Ababa adventure. Find a ride that fits your plans, your pace, and your budget.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/cars">Browse cars <span aria-hidden="true">↗</span></Link>
                <a className="text-link" href="#how-it-works">How it works <span aria-hidden="true">↓</span></a>
              </div>
    
            </div>
            <div className="hero-visual">
              <div className="hero-image-wrap">
                <Image
                  className="hero-image"
                  src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=85"
                  alt="A polished silver sports car ready for a city drive"
                  fill
                  priority
                  sizes="(max-width: 800px) 100vw, 55vw"
                />
                <div className="hero-image-shade" />
                <div className="hero-image-caption"><span>01 / 06</span></div>
              </div>
              <div className="hero-sticker"><span className="sticker-star" aria-hidden="true">✳</span><span>GOOD<br />TRIPS<br />START HERE</span></div>
              <div className="hero-floating-card">
                <span className="floating-card-icon" aria-hidden="true">↗</span>
                <div><strong>Your next ride</strong><span>Closer than you think.</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="search-section page-width" aria-label="Find a car">
          <CarSearch />
        </section>

        <section className="section-block page-width" id="featured-cars">
          <div className="section-heading">
            <div><span className="eyebrow">A FEW GOOD RIDES</span><h2>Find your next favorite.</h2><p>Local cars, ready for wherever the day takes you.</p></div>
            <Link className="text-link section-link" href="/cars">Explore all cars <span aria-hidden="true">↗</span></Link>
          </div>
          <FeaturedCars />
        </section>

        <section className="steps-section" id="how-it-works">
          <div className="page-width">
            <div className="section-heading steps-heading">
              <div><span className="eyebrow">EASY AS ONE, TWO, GO</span><h2>Less planning. More living.</h2><p>Your next Addis adventure is just a few simple steps away.</p></div>
            </div>
            <div className="steps-grid">
              <article className="step-card"><span className="step-number">01</span><span className="step-symbol" aria-hidden="true">⌕</span><h3>Discover a car</h3><p>Explore local listings and find the right ride for your plans.</p></article>
              <article className="step-card"><span className="step-number">02</span><span className="step-symbol" aria-hidden="true">↗</span><h3>Request a rental</h3><p>Connect with a car owner and share the details of your trip.</p></article>
              <article className="step-card"><span className="step-number">03</span><span className="step-symbol" aria-hidden="true">✳</span><h3>Enjoy the trip</h3><p>Pick up your car and make the most of every mile.</p></article>
            </div>
          </div>
        </section>

        <section className="trust-section page-width" id="why-sheggar">
          <div className="trust-copy"><span className="eyebrow">A BETTER WAY TO GET AROUND</span><h2>Local by nature.<br />Built around you.</h2><p>Sheggar Wheels brings car owners and curious explorers together, right here in Addis Ababa.</p><Link className="button button-dark" href="/cars">Find your ride <span aria-hidden="true">↗</span></Link></div>
          <div className="trust-points">
            <article><span className="trust-icon" aria-hidden="true">✓</span><div><h3>Thoughtful listings</h3><p>Clear details help you know what you’re looking at before you reach out.</p></div></article>
            <article><span className="trust-icon" aria-hidden="true">◎</span><div><h3>Upfront daily prices</h3><p>See the listed daily rate in ETB before you request a booking.</p></div></article>
            <article><span className="trust-icon" aria-hidden="true">⌖</span><div><h3>Closer to home</h3><p>Explore cars listed across neighborhoods in Addis Ababa.</p></div></article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
