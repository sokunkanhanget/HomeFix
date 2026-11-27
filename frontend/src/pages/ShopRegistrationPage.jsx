import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import { loadCustomer } from "../data/customerAccount.js";
import { serviceNames } from "../data/services.js";

const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-[#cbd7e3] bg-white px-3 text-sm text-[#233b57] outline-none focus:border-[#315b82] focus:ring-2 focus:ring-[#dce9f5]";

export default function ShopRegistrationPage() {
  const customer = loadCustomer();
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/shops/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: String(data.get("name")).trim(),
          category: String(data.get("category")),
          address: String(data.get("address")).trim(),
          phone: String(data.get("phone")).trim(),
          email: String(data.get("email")).trim(),
          operatingHours: String(data.get("operatingHours")).trim(),
          description: String(data.get("description")).trim(),
          serviceType: String(data.get("serviceType")),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not submit your registration.");
      setRegistration(result.registration);
      form.reset();
    } catch (submitError) {
      setError(submitError.message || "Could not connect to the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <div className="min-h-screen bg-white text-[#102847]"><Header />
    <main className="mx-auto max-w-[880px] px-[18px] py-10 md:py-14">
      <Link to="/" className="text-sm font-semibold text-[#315b82] hover:underline">← Home</Link>
      <div className="mt-5"><p className="m-0 text-xs font-bold tracking-[.12em] text-[#315b82]">HOMEFIX PARTNERS</p><h1 className="mb-0 mt-2 text-3xl font-bold">Register your repair shop</h1><p className="mb-0 mt-3 text-sm leading-6 text-slate-600">Submit your shop details for review. Approved shops are listed for customers to discover.</p></div>
      {!customer
        ? <p className="mt-7 rounded-xl border border-[#d6dfea] bg-[#f5f8fb] p-5 text-sm">Log in with your shop owner account to submit a registration. <Link className="font-semibold text-[#315b82] underline" to="/login">Log in</Link></p>
        : customer.role !== "owner"
          ? <p className="mt-7 rounded-xl border border-[#d6dfea] bg-[#f5f8fb] p-5 text-sm">This account is not authorized to register a repair shop. Log in with a shop owner account.</p>
          : <form onSubmit={submit} className="mt-7 rounded-2xl border border-[#d6dfea] bg-white p-5 shadow-sm md:p-8">
        {registration && <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{registration.name} has been submitted and is pending admin review.</p>}
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
        <button type="submit" disabled={isSubmitting} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#163f6b] px-5 text-sm font-semibold text-white hover:bg-[#0c2e53] disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Submitting…" : "Submit for review"}</button>
      </form>}
    </main>
    <Footer />
  </div>;
}
