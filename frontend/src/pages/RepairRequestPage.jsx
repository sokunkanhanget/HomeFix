import { useState } from "react";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Icon from "../components/Icon.jsx";
import { useSearchParams } from "react-router-dom";
import { useShops } from "../context/ShopContext.jsx";
import { matchShops, serviceNames, supportsService } from "../data/services.js";

const fieldClass = "mt-1 w-full rounded-lg border border-[#d6dfea] bg-white px-3 py-2.5 text-sm text-[#233b57] outline-none placeholder:text-[#8290a1] focus:border-[#315b82]";

export default function RepairRequestPage() {
  const { directory } = useShops();
  const [params] = useSearchParams();
  const initialShop = directory.find((shop) => shop.id === params.get("shop"));
  const [service, setService] = useState(initialShop?.services[0] || "Air Conditioner");
  const [shopId, setShopId] = useState(initialShop?.id || "cooltech");
  const eligibleShops = matchShops(directory, service);
  const selectedShop = eligibleShops.find((shop) => shop.id === shopId);
  const [submitted, setSubmitted] = useState(false);
  const [photos, setPhotos] = useState([]);

  function submit(event) {
    event.preventDefault();
    if (!selectedShop || !supportsService(selectedShop, service)) return;
    const formData = new FormData(event.currentTarget);
    const appointmentDate = formData.get("date");
    let requests = [];
    try { requests = JSON.parse(localStorage.getItem("homefix-repair-requests") || "[]"); } catch { requests = []; }
    const newRequest = {
      id: `HF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      appliance: formData.get("appliance") || "Home repair",
      issue: formData.get("issue") || "Repair request submitted",
      shop: "CoolTech AC Service",
      location: formData.get("location") || "Phnom Penh",
      date: appointmentDate ? new Date(`${appointmentDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "To be confirmed",
      time: formData.get("time") || "To be confirmed",
      status: "Awaiting confirmation",
    };
    try { localStorage.setItem("homefix-repair-requests", JSON.stringify([newRequest, ...requests])); } catch { /* the submitted state still confirms this session's request */ }
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-white text-[#102847]">
      <Header />
      <header className="bg-[#f1f4f8] px-[18px] py-10 md:px-0 md:py-[64px]">
        <div className="mx-auto max-w-[1200px]">
          <h1 className="m-0 text-[32px] font-bold tracking-[-1px] md:text-[40px]">Request a Repair</h1>
          <a href="/my-repair-requests" className="mt-3 inline-flex origin-left text-base font-semibold text-[#315b82] underline-offset-4 transition duration-150 hover:scale-105 hover:text-[#163f6b] hover:underline">View my repair requests</a>
          <p className="mt-3 max-w-[760px] text-[15px] leading-6 text-[#5a6b82]">Tell us what’s broken and when you’re free. We’ll send it to the shop and confirm the visit with you.</p>
        </div>
      </header>
      <main className="mx-auto grid max-w-[1200px] gap-5 px-[18px] py-8 md:grid-cols-[1fr_384px] md:px-0 md:py-12">
        <form className="rounded-2xl border border-[#d6dfea] bg-white p-6 shadow-[0_8px_24px_rgba(11,31,58,.04)] md:p-9" onSubmit={submit}>
          <RequestSection number="1" title="What needs fixing?" description="Pick the appliance and describe the problem.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold">Appliance type<select className={fieldClass} value={service} onChange={(event) => { const next = event.target.value; setService(next); setShopId(matchShops(directory, next)[0]?.id || ""); setSubmitted(false); }}>{serviceNames.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-xs font-semibold">Brand / model (optional)<input className={fieldClass} placeholder="e.g. Daikin 1.5HP inverter" /></label>
            </div>
            <label className="mt-4 block text-xs font-semibold">Describe the problem<textarea name="issue" className={`${fieldClass} min-h-[118px] resize-y`} placeholder="e.g. AC turns on but blows warm air, and water is dripping from the indoor unit since yesterday." /></label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#315b82] bg-[#f7faff] p-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-white text-[#315b82]"><Icon name="store" size={17} /></span><span><b className="block text-sm">Add photos of the problem (optional)</b><small className="text-xs text-[#6a7b91]">{photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} selected` : "PNG or JPG · up to 5 photos"}</small></span></div><label className="cursor-pointer rounded-lg border border-[#123b66] px-3 py-2 text-xs font-semibold text-[#123b66]">Browse files<input className="sr-only" type="file" accept="image/png,image/jpeg" multiple onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 5))} /></label></div>
          </RequestSection>
          <RequestSection number="2" title="Where and when?" description="Choose a time that works for you.">
            <label className="block text-xs font-semibold">Address<input name="location" className={fieldClass} defaultValue="House 12, Street 271, Toul Kork" /></label>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold">Preferred date<input name="date" type="date" className={fieldClass} defaultValue="2026-11-20" /></label><label className="text-xs font-semibold">Preferred time<select name="time" className={fieldClass} defaultValue="Morning (8:00 – 12:00)"><option>Morning (8:00 – 12:00)</option><option>Afternoon (12:00 – 17:00)</option><option>Evening (17:00 – 20:00)</option></select></label></div>
            <fieldset className="mt-4"><legend className="text-xs font-semibold">Service type</legend><div className="mt-2 flex flex-wrap gap-5 text-xs text-[#5a6b82]"><label className="flex items-center gap-2"><input type="radio" name="service" defaultChecked /> Home visit – technician comes to me</label><label className="flex items-center gap-2"><input type="radio" name="service" /> I’ll bring it to the shop</label></div></fieldset>
          </RequestSection>
          <RequestSection number="3" title="Your contact details" description="So the shop and our team can reach you.">
            <div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold">Full name<input required className={fieldClass} placeholder="Your full name" /></label><label className="text-xs font-semibold">Phone number<input required type="tel" inputMode="tel" pattern="(?:\\+855[\\s-]?)?(?:0)?[1-9][0-9\\s-]{7,12}" title="Enter a valid Cambodian phone number, for example 012 345 678" className={fieldClass} placeholder="012 345 678" /></label></div>
            <label className="mt-4 flex items-center gap-2 text-xs text-[#233b57]"><input type="checkbox" required defaultChecked /> I agree to be contacted by HomeFix and the repair shop about this request.</label>
          </RequestSection>
          {submitted && selectedShop && <p className="rounded-lg bg-[#e3f4ec] p-3 text-sm text-[#226b50]">This demo request matches {selectedShop?.name} for {service}. Booking submission will be available when the server is connected.</p>}
          <div className="mt-6 flex justify-end gap-4"><a href="/" className="self-center text-sm text-[#123b66]">Cancel</a><button disabled={!selectedShop} className="disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2 rounded-lg bg-[#123b66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0c2e53]" type="submit"><Icon name="arrow" size={15} /> Submit Request</button></div>
        </form>
        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-[#d6dfea] p-6"><label className="block text-xs font-bold tracking-[.08em] text-[#315b82]" htmlFor="request-shop">REQUESTING FROM</label><select id="request-shop" required className={fieldClass} value={selectedShop?.id || ""} onChange={(event) => { setShopId(event.target.value); setSubmitted(false); }}><option value="" disabled>Select a supported shop</option>{eligibleShops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>{selectedShop ? <><p className="mt-4 text-sm font-semibold">{selectedShop.name}</p><p className="mt-2 text-xs text-[#6a7b91]">{selectedShop.location}</p><p className="mt-3 text-xs text-[#258a62]">Supports {service}</p></> : <p role="status" className="mt-4 text-sm text-[#6a7b91]">{eligibleShops.length ? "Choose a shop that supports this service." : "No shops currently support this category. Choose another service."}</p>}</section>
          <section className="rounded-2xl border border-[#d6dfea] p-6"><h2 className="m-0 text-base font-bold">What happens next</h2><ol className="mt-4 grid gap-4 text-xs leading-5 text-[#6a7b91]"><li><b className="mr-2 inline-grid size-5 place-items-center rounded-full bg-[#e3edf7] text-[#315b82]">1</b>We alert the shop and our admin team right away.</li><li><b className="mr-2 inline-grid size-5 place-items-center rounded-full bg-[#e3edf7] text-[#315b82]">2</b>The shop confirms a time — usually within 30 minutes.</li><li><b className="mr-2 inline-grid size-5 place-items-center rounded-full bg-[#e3edf7] text-[#315b82]">3</b>You get a call or SMS to confirm the visit.</li></ol></section>
          <section className="rounded-2xl bg-[#fde7e5] p-6"><h2 className="m-0 text-base font-bold">⚠ Can’t wait?</h2><p className="text-xs leading-5 text-[#6a6f7b]">For leaks, power faults or a dead AC in the heat, use Emergency Service for priority help.</p><a href="tel:119" className="inline-flex rounded-lg bg-[#c9343b] px-3 py-2 text-xs font-semibold text-white">☎ Emergency Service</a></section>
        </aside>
      </main>
      <Footer />
    </div>
  );
}

function RequestSection({ number, title, description, children }) {
  return <section className="border-b border-[#d6dfea] py-1 pb-6 pt-0 first:pt-0 last:border-0 last:pb-0 [&+section]:mt-6"><div className="mb-5 flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#123b66] text-xs font-bold text-white">{number}</span><div><h2 className="m-0 text-base font-bold">{title}</h2><p className="m-0 text-xs text-[#6a7b91]">{description}</p></div></div>{children}</section>;
}
