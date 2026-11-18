import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import RepairRequestPage from "./pages/RepairRequestPage.jsx";
import ShopServicesPage from "./pages/ShopServicesPage.jsx";
import { ShopProvider } from "./context/ShopContext.jsx";

export default function App() {
  return (
    <ShopProvider><BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/request-repair" element={<RepairRequestPage />} />
        <Route path="/shop/services" element={<ShopServicesPage />} />
      </Routes>
    </BrowserRouter></ShopProvider>
  );
}
