import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useShops } from "../context/ShopContext.jsx";

const emptyForm = { name: "", description: "", address: "", phone: "", operatingHours: "", imageUrl: "" };
const fields = [
  ["name", "Business name", "text", "Your shop name"],
  ["address", "Business address", "text", "Street, district, city"],
  ["phone", "Contact number", "tel", "+855 12 345 678"],
  ["operatingHours", "Operating hours", "text", "Mon–Sat 8:00–18:00"],
  ["imageUrl", "Shop image URL (optional)", "url", "https://example.com/shop.jpg"],
];

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Enter your business name.";
  if (!form.address.trim()) errors.address = "Enter your business address.";
  const digits = form.phone.replace(/\D/g, "").length;
  if (!form.phone.trim() || digits < 8 || digits > 15 || !/^[+\d][\d\s().-]*$/.test(form.phone.trim())) {
    errors.phone = "Enter a valid contact number with 8 to 15 digits.";
  }
  if (form.name.trim().length > 120) errors.name = "Business name must be 120 characters or fewer.";
  if (form.description.trim().length > 1000) errors.description = "Description must be 1,000 characters or fewer.";
  if (form.address.trim().length > 240) errors.address = "Address must be 240 characters or fewer.";
  if (form.operatingHours.trim().length > 120) errors.operatingHours = "Operating hours must be 120 characters or fewer.";
  if (form.imageUrl.trim()) {
    try {
      if (!["http:", "https:"].includes(new URL(form.imageUrl.trim()).protocol)) throw new Error("Invalid protocol");
    } catch {
      errors.imageUrl = "Enter a valid http or https image URL.";
    }
  }
  return errors;
}

async function readResult(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Could not load the shop profile.");
  return result;
}

export default function OwnerProfilePage() {
  const { refreshPublicShops } = useShops();
  const [shop, setShop] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/owner/shop-profile", { credentials: "include" })
      .then(readResult)
      .then(({ data }) => {
        if (!active) return;
        setShop(data);
        setForm({
          name: data.name || "",
          description: data.description || "",
          address: data.address || "",
          phone: data.phone || "",
          operatingHours: data.operatingHours || "",
          imageUrl: data.imageUrl || "",
        });
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setMessage("");
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setMessage("");
    setError("");
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const result = await readResult(await fetch("/api/owner/shop-profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }));
      await refreshPublicShops();
      setShop(result.data);
      setForm({
        name: result.data.name || "",
        description: result.data.description || "",
        address: result.data.address || "",
        phone: result.data.phone || "",
        operatingHours: result.data.operatingHours || "",
        imageUrl: result.data.imageUrl || "",
      });
      setMessage("Shop profile updated. Customers will see the latest information.");
    } catch (saveError) {
      setError(saveError.message || "Could not save your shop profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-[1200px] px-[18px] py-10"><p role="status">Loading shop profile…</p></main>;

  return <main className="mx-auto max-w-[1200px] px-[18px] py-10">
    <h1 className="text-3xl font-bold">Shop profile</h1>
    <p className="mt-3 text-sm text-slate-500">Edit the business details customers use to find and contact your shop.</p>
    {error && !shop ? <section role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p>{error}</p>
      <p className="mb-0 mt-2">Sign in with the shop owner account linked to this shop. If the shop has not been linked yet, ask an administrator to assign it.</p>
      <Link to="/login" className="mt-3 inline-block font-semibold underline">Go to log in</Link>
    </section> : <section className="mt-7 grid overflow-hidden rounded-2xl border border-[#d6dfea] bg-white md:grid-cols-[320px_1fr]">
      {form.imageUrl ? <img src={form.imageUrl} alt={`${form.name} shop`} className="h-64 w-full bg-slate-100 object-cover md:h-full" /> : <div className="grid min-h-48 place-items-center bg-pale text-sm text-slate-500">No shop image provided</div>}
      <div className="p-6 md:p-8">
        <form onSubmit={submit} noValidate>
          <h2 className="m-0 text-xl font-bold">Business information</h2>
          <div className="mt-5 grid gap-4">
            {fields.map(([name, label, type, placeholder]) => <div key={name}>
              <label htmlFor={`shop-${name}`} className="mb-1.5 block text-sm font-semibold">{label}</label>
              <input id={`shop-${name}`} name={name} type={type} maxLength={name === "imageUrl" ? 2048 : undefined} value={form[name]} onChange={change} placeholder={placeholder} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `shop-${name}-error` : undefined} className="min-h-11 w-full rounded-lg border border-[#cbd7e3] px-3 text-sm outline-none focus:border-[#315b82] focus:ring-2 focus:ring-[#dce9f5]" />
              {errors[name] && <p id={`shop-${name}-error`} className="mb-0 mt-1 text-xs text-red-700">{errors[name]}</p>}
            </div>)}
            <div>
              <label htmlFor="shop-description" className="mb-1.5 block text-sm font-semibold">Business description</label>
              <textarea id="shop-description" name="description" value={form.description} onChange={change} maxLength={1000} rows={5} aria-invalid={Boolean(errors.description)} className="w-full rounded-lg border border-[#cbd7e3] px-3 py-2 text-sm outline-none focus:border-[#315b82] focus:ring-2 focus:ring-[#dce9f5]" />
              {errors.description && <p role="alert" className="mb-0 mt-1 text-xs text-red-700">{errors.description}</p>}
            </div>
          </div>
          {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          {error && shop && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue px-5 text-sm font-semibold text-white hover:bg-[#0c2e53] disabled:opacity-60"><Icon name="check" size={16}/>{saving ? "Saving…" : "Save changes"}</button>
            <Link to={`/repair-shops/${shop.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`} className="text-sm font-semibold text-blue hover:underline">View public profile</Link>
          </div>
        </form>
      </div>
    </section>}
  </main>;
}
