import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RepairRequestPage from "./pages/RepairRequestPage.jsx";
import ShopServicesPage from "./pages/ShopServicesPage.jsx";
import { ShopProvider } from "./context/ShopContext.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import RepairShopsPage from "./pages/RepairShopsPage.jsx";
import RepairShopDetailPage from "./pages/RepairShopDetailPage.jsx";
import RepairRequestsPage from "./pages/RepairRequestsPage.jsx";
import EmergencyServicePage from "./pages/EmergencyServicePage.jsx";

export default function App() {
  return (
    <ShopProvider><BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgotpassword" element={<ForgotPasswordPage />} />
        <Route path="/request-repair" element={<RepairRequestPage />} />
        <Route path="/shop/services" element={<ShopServicesPage />} />
        <Route path="/my-repair-requests" element={<RepairRequestsPage />} />
        <Route path="/cancel-repair-request" element={<Navigate to="/my-repair-requests" replace />} />
        <Route path="/repair-shops" element={<RepairShopsPage />} />
        <Route path="/repair-shops/:shopSlug" element={<RepairShopDetailPage />} />
        <Route path="/emergency-service" element={<EmergencyServicePage />} />
      </Routes>
    </BrowserRouter></ShopProvider>
  );
}
