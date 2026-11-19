import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import { useShops } from "../context/ShopContext.jsx";
import { serviceNames } from "../data/services.js";

const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-[#cbd7e3] bg-white px-3 text-sm text-[#233b57] outline-none focus:border-[#315b82] focus:ring-2 focus:ring-[#dce9f5]";

export default function ShopRegistrationPage() {
  const { submitShopRegistration } = useShops();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      submitShopRegistration({
        name: String(data.get("name")).trim(),
        category: String(data.get("category")),
        address: String(data.get("address")).trim(),
        location: String(data.get("address")).trim(),
        phone: String(data.get("phone")).trim(),
        email: String(data.get("email")).trim(),
        operatingHours: String(data.get("operatingHours")).trim(),
        description: String(data.get("description")).trim(),
        serviceType: String(data.get("serviceType")),
      });
      setSubmitted(true);
      setError("");
      event.currentTarget.reset();
    } catch {
      setError("Could not submit your registration. Please allow browser storage and try again.");
    }
  }

  return <div className="min-h-screen bg-white text-[#102847]"><Header />
    <main className="mx-auto max-w-[880px] px-[18px] py-10 md:py-14">
      <Link to="/" className="text-sm font-semibold text-[#315b82] hover:underline">← Home</Link>
      <div className="mt-5"><p className="m-0 text-xs font-bold tracking-[.12em] text-[#315b82]">HOMEFIX PARTNERS</p><h1 className="mb-0 mt-2 text-3xl font-bold">Register your repair shop</h1><p className="mb-0 mt-3 text-sm leading-6 text-slate-600">Submit your shop details for review. Approved shops are listed for customers to discover.</p></div>
      <form onSubmit={submit} className="mt-7 rounded-2xl border border-[#d6dfea] bg-white p-5 shadow-sm md:p-8">
        {submitted && <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">Registration submitted. It is now pending admin review.</p>}
        {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">Business name<input name="name" required maxLength={120} className={inputClass} placeholder="Your registered business name" /></label>
          <label className="text-sm font-semibold">Main service category<select name="category" required defaultValue="" className={inputClass}><option value="" disabled>Select a category</option>{serviceNames.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="text-sm font-semibold sm:col-span-2">Physical address<input name="address" required minLength={8} maxLength={240} className={inputClass} placeholder="Street or building, district, city" /></label>
          <label className="text-sm font-semibold">Direct phone number<input name="phone" type="tel" required inputMode="tel" pattern={String.raw`(?:\+855[\s-]?)?(?:0)?[1-9][0-9\s()-]{7,12}`} title="Enter a valid Cambodian contact number" className={inputClass} placeholder="012 345 678" /></label>
          <label className="text-sm font-semibold">Business email<input name="email" type="email" required maxLength={254} className={inputClass} placeholder="you@example.com" /></label>
          <label className="text-sm font-semibold">Operating hours<input name="operatingHours" required maxLength={120} className={inputClass} placeholder="Mon–Sat 8:00–18:00" /></label>
          <label className="text-sm font-semibold">Service type<select name="serviceType" className={inputClass}><option>Home service</option><option>In-shop repair</option><option>Home service and in-shop repair</option></select></label>
          <label className="text-sm font-semibold sm:col-span-2">About your shop<textarea name="description" required minLength={20} maxLength={1000} className={`${inputClass} min-h-28 resize-y py-3`} placeholder="Describe your services and experience." /></label>
        </div>
        <button type="submit" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#163f6b] px-5 text-sm font-semibold text-white hover:bg-[#0c2e53]">Submit for review</button>
      </form>
    </main>
    <Footer />
  </div>;
}
