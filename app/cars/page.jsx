import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import CarCatalogue from "@/app/components/car-catalogue";

export const metadata = {
  title: "Explore cars | Sheggar Wheels",
  description: "Browse cars available for rent across Addis Ababa.",
};

export default function CarsPage() {
  return (
    <>
      <SiteHeader />
      <main className="catalogue-main"><CarCatalogue /></main>
      <SiteFooter />
    </>
  );
}
