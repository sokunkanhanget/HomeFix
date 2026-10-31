import { useEffect, useState } from "react";
import Footer from "./components/Footer.jsx";
import Header from "./components/Header.jsx";
import HeroSection from "./components/HeroSection.jsx";
import ServicesSection from "./components/ServicesSection.jsx";

export default function App() {
  const [apiStatus, setApiStatus] = useState("Checking connection...");

  useEffect(() => {
    let active = true;

    fetch("/api/health")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "API is unavailable");
        }
        return result;
      })
      .then((result) => {
        if (active) {
          setApiStatus(`API and database connected · ${result.database}`);
        }
      })
      .catch(() => {
        if (active) {
          setApiStatus("API or database connection unavailable");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f8f8f5] text-[#20251f]">
      <Header />
      <HeroSection />
      <ServicesSection />
      <Footer apiStatus={apiStatus} />
    </main>
  );
}
