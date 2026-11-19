import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useShops } from "../context/ShopContext.jsx";
import Icon from "../components/Icon.jsx";

function initialForm(shop) {
  return {
    name: shop.name || "",
    address: shop.profile?.address || shop.location || "",
    operatingHours: shop.profile?.operatingHours || "",
    phone: shop.phone || "",
    secondaryPhone: shop.secondaryPhone || "",
  };
}

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Enter your business name.";
  const addressParts = form.address.split(",").map((part) => part.trim()).filter(Boolean);
  if (addressParts.length < 2 || addressParts.some((part) => part.length < 3)) {
    errors.address = "Enter a complete address with street and area, separated by commas.";
  }
  if (!form.operatingHours.trim()) errors.operatingHours = "Enter your operating hours.";
  const validPhone = (value) => {
    if (!value.trim()) return false;
    const digits = value.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 && /^[+\d][\d\s().-]*$/.test(value.trim());
  };
  if (!validPhone(form.phone)) errors.phone = "Enter a valid direct contact number (8–15 digits).";
  if (form.secondaryPhone.trim() && !validPhone(form.secondaryPhone)) errors.secondaryPhone = "Enter a valid number or leave this optional field blank.";
  return errors;
}

export default function OwnerProfilePage() {
  const { ownerShop: shop, saveShopProfile } = useShops();
  const [form, setForm] = useState(() => initialForm(shop));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setForm(initialForm(shop));
    setErrors({});
    setMessage("");
    setSaveError("");
  }, [shop.id]);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
    setSaveError("");
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setMessage("");
    setSaveError("");
    if (Object.keys(nextErrors).length) return;
    try {
      saveShopProfile(shop.id, {
        name: form.name.trim(),
        location: form.address.trim(),
        profile: { ...shop.profile, address: form.address.trim(), operatingHours: form.operatingHours.trim() },
        operatingHours: form.operatingHours.trim(),
        phone: form.phone.trim(),
        secondaryPhone: form.secondaryPhone.trim(),
      });
      setMessage("Shop profile saved. Customers will see these updates on your public profile.");
    } catch {
      setSaveError("Could not save your changes in this browser. Please check available storage and try again.");
    }
  }

  const fields = [
    ["name", "Business name", "text", "Your shop name"],
    ["address", "Physical address", "text", "Street or building, district, city"],
    ["operatingHours", "Operating hours", "text", "Example: Mon–Sat 8:00–19:00 · Sun 9:00–17:00"],
    ["phone", "Primary direct contact number", "tel", "+855 12 345 678"],
    ["secondaryPhone", "Additional contact number (optional)", "tel", "+855 12 345 678"],
  ];

  return <main className="mx-auto max-w-[1200px] px-[18px] py-10">
    <h1 className="text-3xl font-bold">Shop profile</h1>
    <p className="mt-3 text-sm text-slate-500">Edit the business details customers use to find and contact your shop.</p>
    <section className="mt-7 grid overflow-hidden rounded-2xl border border-[#d6dfea] bg-white md:grid-cols-[320px_1fr]">
      <img src={shop.image} alt={shop.name} className="h-64 w-full object-cover md:h-full" />
      <div className="p-6 md:p-8">
        <form onSubmit={submit} noValidate>
          <h2 className="m-0 text-xl font-bold">Business information</h2>
          <div className="mt-5 grid gap-4">
            {fields.map(([name, label, type, placeholder]) => <div key={name}>
              <label htmlFor={`shop-${name}`} className="mb-1.5 block text-sm font-semibold">{label}</label>
              <input id={`shop-${name}`} name={name} type={type} value={form[name]} onChange={change} placeholder={placeholder} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `shop-${name}-error` : undefined} className="min-h-11 w-full rounded-lg border border-[#cbd7e3] px-3 text-sm outline-none focus:border-[#315b82] focus:ring-2 focus:ring-[#dce9f5]" />
              {errors[name] && <p id={`shop-${name}-error`} className="mb-0 mt-1 text-xs text-red-700">{errors[name]}</p>}
            </div>)}
          </div>
          {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          {saveError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{saveError}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue px-5 text-sm font-semibold text-white hover:bg-[#0c2e53]"><Icon name="check" size={16}/>Save changes</button>
            <Link to={`/repair-shops/${shop.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`} className="text-sm font-semibold text-blue hover:underline">View public profile</Link>
          </div>
        </form>
        <h3 className="mt-8 text-sm font-bold">Supported service categories</h3>
        <div className="mt-3 flex flex-wrap gap-2">{shop.services.length ? shop.services.map((service) => <span key={service} className="rounded-full bg-pale px-3 py-2 text-xs font-semibold text-blue">{service}</span>) : <p className="text-sm text-slate-500">No service categories selected.</p>}</div>
        <Link to="/owner/services" className="mt-5 inline-flex rounded-lg border border-[#d6dfea] px-4 py-3 text-sm font-semibold text-blue hover:bg-pale">Manage service categories</Link>
      </div>
    </section>
  </main>;
}
