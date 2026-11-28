import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RepairRequestPage from "./pages/RepairRequestPage.jsx";
import ShopServicesPage from "./pages/ShopServicesPage.jsx";
import { ShopProvider } from "./context/ShopContext.jsx";

import OwnerLayout from "./layouts/OwnerLayout.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import RepairShopsPage from "./pages/RepairShopsPage.jsx";
import RepairShopDetailPage from "./pages/RepairShopDetailPage.jsx";
import RepairRequestsPage from "./pages/RepairRequestsPage.jsx";
import OwnerDashboardPage from "./pages/OwnerDashboardPage.jsx";
import OwnerRequestsPage from "./pages/OwnerRequestsPage.jsx";
import OwnerEmergencyRequestsPage from "./pages/OwnerEmergencyRequestsPage.jsx";
import OwnerProfilePage from "./pages/OwnerProfilePage.jsx";

import EmergencyServicePage from "./pages/EmergencyServicePage.jsx";
import CustomerProfilePage from "./pages/CustomerProfilePage.jsx";
import MyProfilePage from "./pages/MyProfilePage.jsx";
import ShopRequestsPage from "./pages/ShopRequestsPage.jsx";
import RepairRequestDetailsPage from "./pages/RepairRequestDetailsPage.jsx";
import ShopRegistrationPage from "./pages/ShopRegistrationPage.jsx";
import AdminShopRegistrationsPage from "./pages/AdminShopRegistrationsPage.jsx";
import AdminActivityLogPage from "./pages/AdminActivityLogPage.jsx";

export default function App() {
  return (
    <ShopProvider><BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/shop-register" element={<ShopRegistrationPage />} />
        <Route path="/admin" element={<Navigate to="/admin/shops" replace />} />
        <Route path="/admin/shops" element={<AdminShopRegistrationsPage />} />
        <Route path="/admin/activity" element={<AdminActivityLogPage />} />
        <Route path="/forgotpassword" element={<ForgotPasswordPage />} />
        <Route path="/request-repair" element={<RepairRequestPage />} />

        <Route path="/owner" element={<OwnerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<OwnerDashboardPage />} />
          <Route path="requests" element={<OwnerRequestsPage />} />
          <Route path="emergency-requests" element={<OwnerEmergencyRequestsPage />} />
          <Route path="profile" element={<OwnerProfilePage />} />
          <Route path="services" element={<ShopServicesPage />} />
        </Route>
        <Route path="/shop/services" element={<Navigate to="/owner/services" replace />} />
        <Route path="/shop/requests" element={<Navigate to="/owner/requests" replace />} />
        <Route path="/my-repair-requests" element={<RepairRequestsPage />} />
        <Route path="/my-repair-requests/:requestId" element={<RepairRequestDetailsPage />} />
        <Route path="/cancel-repair-request" element={<Navigate to="/my-repair-requests" replace />} />
        <Route path="/repair-shops" element={<RepairShopsPage />} />
        <Route path="/repair-shops/:shopSlug" element={<RepairShopDetailPage />} />
        <Route path="/emergency-service" element={<EmergencyServicePage />} />
        <Route path="/dashboard" element={<Navigate to="/#dashboard" replace />} />
        <Route path="/profile" element={<CustomerProfilePage />} />
        <Route path="/my-profile" element={<MyProfilePage />} />
      </Routes>
    </BrowserRouter></ShopProvider>
  );
}
