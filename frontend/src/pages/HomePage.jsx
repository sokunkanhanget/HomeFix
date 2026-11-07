import { useMemo, useState } from "react";
import CategorySection from "../components/CategorySection.jsx";
import FeaturedShops from "../components/FeaturedShops.jsx";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import HeroSection from "../components/HeroSection.jsx";
import ShopDetailsDialog from "../components/ShopDetailsDialog.jsx";
import StepsSection from "../components/StepsSection.jsx";
import { shops } from "../data/homepage.js";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Your location");
  const [searched, setSearched] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);

  const visibleShops = useMemo(() => {
    if (!searched || !query.trim()) return shops;
    const searchTerm = query.trim().toLowerCase();
    return shops.filter((shop) =>
      [shop.name, shop.category, shop.description].some((value) =>
        value.toLowerCase().includes(searchTerm),
      ),
    );
  }, [query, searched]);

  function handleSearch(event) {
    event.preventDefault();
    setSearched(true);
    document.getElementById("shops")?.scrollIntoView({ behavior: "smooth" });
  }

  function selectCategory(category) {
    setQuery(category);
    setSearched(true);
    document.getElementById("shops")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main id="top" className="min-h-screen overflow-hidden text-navy">
      <Header />
      <HeroSection
        query={query}
        location={location}
        onQueryChange={setQuery}
        onLocationChange={setLocation}
        onSearch={handleSearch}
      />
      <CategorySection onSelectCategory={selectCategory} />
      <FeaturedShops
        shops={visibleShops}
        query={query}
        location={location}
        searched={searched}
        onShopSelect={setSelectedShop}
        onReset={() => {
          setQuery("");
          setSearched(false);
        }}
      />
      <StepsSection />
      <Footer />
      {selectedShop && (
        <ShopDetailsDialog
          shop={selectedShop}
          onClose={() => setSelectedShop(null)}
        />
      )}
    </main>
  );
}
