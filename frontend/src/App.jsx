import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import RepairRequestPage from "./pages/RepairRequestPage.jsx";
import ShopServicesPage from "./pages/ShopServicesPage.jsx";
import { ShopProvider } from "./context/ShopContext.jsx";
import OwnerLayout from "./layouts/OwnerLayout.jsx";

export default function App() {
  return (
    <ShopProvider><BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/request-repair" element={<RepairRequestPage />} />
        <Route path="/owner" element={<OwnerLayout />}>
          <Route index element={<Navigate to="services" replace />} />
          <Route path="services" element={<ShopServicesPage />} />
        </Route>
        <Route path="/shop/services" element={<Navigate to="/owner/services" replace />} />
      </Routes>
    </BrowserRouter></ShopProvider>
  );
}
