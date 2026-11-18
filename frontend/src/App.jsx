import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RepairRequestPage from "./pages/RepairRequestPage.jsx";
import ShopServicesPage from "./pages/ShopServicesPage.jsx";
import { ShopProvider } from "./context/ShopContext.jsx";
<<<<<<< HEAD
import OwnerLayout from "./layouts/OwnerLayout.jsx";
=======
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import RepairShopsPage from "./pages/RepairShopsPage.jsx";
import RepairShopDetailPage from "./pages/RepairShopDetailPage.jsx";
import RepairRequestsPage from "./pages/RepairRequestsPage.jsx";
>>>>>>> 3d29a8c17ab1c737ffe5a882dbc2c5c70b98207b

export default function App() {
  return (
    <ShopProvider><BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgotpassword" element={<ForgotPasswordPage />} />
        <Route path="/request-repair" element={<RepairRequestPage />} />
<<<<<<< HEAD
        <Route path="/owner" element={<OwnerLayout />}>
          <Route index element={<Navigate to="services" replace />} />
          <Route path="services" element={<ShopServicesPage />} />
        </Route>
        <Route path="/shop/services" element={<Navigate to="/owner/services" replace />} />
=======
        <Route path="/shop/services" element={<ShopServicesPage />} />
        <Route path="/my-repair-requests" element={<RepairRequestsPage />} />
        <Route path="/cancel-repair-request" element={<Navigate to="/my-repair-requests" replace />} />
        <Route path="/repair-shops" element={<RepairShopsPage />} />
        <Route path="/repair-shops/:shopSlug" element={<RepairShopDetailPage />} />
>>>>>>> 3d29a8c17ab1c737ffe5a882dbc2c5c70b98207b
      </Routes>
    </BrowserRouter></ShopProvider>
  );
}
