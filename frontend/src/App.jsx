import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import RepairRequestPage from "./pages/RepairRequestPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/request-repair" element={<RepairRequestPage />} />
      </Routes>
    </BrowserRouter>
  );
}
