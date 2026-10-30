import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer" id="coming-soon">
      <div className="footer-main page-width">
        <div className="footer-brand-block">
          <Link className="brand brand-light" href="/">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span>sheggar<span className="brand-wheels">wheels</span></span>
          </Link>
          <p>A local way to find your next ride.<br />Made with Addis Ababa in mind.</p>
        </div>
        <div className="footer-column"><h2>Explore</h2><Link href="/cars">Find a car</Link><Link href="/#how-it-works">How it works</Link><Link href="/#why-sheggar">Our story</Link></div>
        <div className="footer-column"><h2>Getting started</h2><Link href="/owner/cars/new">List your car</Link><Link href="/signup">Create an account</Link><Link href="/signin">Sign in</Link></div>
        <div className="footer-column" id="contact"><h2>Need a hand?</h2><span>Questions? Contact our support team.</span><span>Addis Ababa, Ethiopia</span></div>
      </div>
      <div className="footer-bottom page-width"><span>© 2026 Sheggar Wheels.</span><span>Made for Addis Ababa.</span></div>
    </footer>
  );
}
