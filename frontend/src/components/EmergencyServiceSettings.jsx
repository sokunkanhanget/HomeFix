import { useEffect, useState } from "react";
import { customerChangedEvent } from "../data/customerAccount.js";

export default function EmergencyServiceSettings() {
  const [shop, setShop] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let controller;
    function load() {
      controller?.abort();
      controller = new AbortController();
      setShop(null);
      setError("");
      setMessage("");
      fetch("/api/shops/owner/emergency-service", { credentials: "include", signal: controller.signal })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "Could not load emergency service settings.");
          return result.shop;
        })
        .then(setShop)
        .catch((err) => { if (err.name !== "AbortError") setError(err.message); });
    }
    load();
    window.addEventListener(customerChangedEvent, load);
    return () => { controller?.abort(); window.removeEventListener(customerChangedEvent, load); };
  }, []);

  async function toggle(supportsEmergency) {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/shops/owner/emergency-service", {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportsEmergency }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not save emergency service settings.");
      setShop(result.shop);
      setMessage(supportsEmergency ? "Emergency requests are enabled for your shop." : "New emergency requests are disabled. Existing requests remain available.");
    } catch (err) { setError(err.message || "Could not connect to the server."); }
    finally { setSaving(false); }
  }

  return <section aria-label="Emergency service settings" className="mt-6 rounded-xl border border-[#d6dfea] bg-white p-5">
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={shop?.supportsEmergency === true} disabled={!shop || saving} onChange={(event) => toggle(event.target.checked)} className="mt-1" /><span><strong>Offer emergency repair services{shop ? ` at ${shop.name}` : ""}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Customers can send urgent requests when this is enabled. Each request requires your acceptance. Immediate service and availability are not guaranteed.</span></span></label>
    {saving && <p role="status" className="mt-3 text-xs text-slate-500">Saving settings...</p>}
    {message && <p role="status" className="mt-3 text-xs text-emerald-700">{message}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
  </section>;
}
