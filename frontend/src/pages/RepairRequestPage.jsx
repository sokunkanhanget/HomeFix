import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Icon from "../components/Icon.jsx";
import { useSearchParams } from "react-router-dom";
import { serviceNames } from "../data/services.js";
import { parseRequests, requestStorageKey, saveRequests } from "../data/ownerRequests.js";
import { loadCustomer } from "../data/customerAccount.js";
import { MAX_REPAIR_PHOTOS, REPAIR_PHOTO_ACCEPT, validateRepairPhotos } from "../data/repairPhotos.js";

const fieldClass = "mt-1 w-full rounded-lg border-2 border-[#d6dfea] bg-white px-3 py-2.5 text-sm text-[#233b57] outline-none placeholder:text-[#8290a1] focus:border-[#315b82]";

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateValue(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDateValue(date) === value;
}

export default function RepairRequestPage() {
  const [params] = useSearchParams();
  const [emergency, setEmergency] = useState(params.get("priority") === "emergency");
  const [service, setService] = useState(serviceNames.includes(params.get("category")) ? params.get("category") : "Air Conditioner");
  const [shopId, setShopId] = useState("");
  const [approvedShops, setApprovedShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [shopLoadError, setShopLoadError] = useState("");
  const eligibleShops = approvedShops.filter((shop) => shop.category === service && (!emergency || shop.supportsEmergency === true));
  const selectedShop = eligibleShops.find((shop) => shop.id === shopId);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState("");
  const [saveError, setSaveError] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = localDateValue();
  const tomorrow = localDateValue(new Date(Date.now() + 24 * 60 * 60 * 1000));

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/shops?limit=100", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Could not load approved repair shops.");
        setApprovedShops(Array.isArray(result.data) ? result.data : []);
        setShopLoadError("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setShopLoadError(error.message || "Could not load approved repair shops.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setShopsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (eligibleShops.some((shop) => shop.id === shopId)) return;
    const requestedShop = eligibleShops.find((shop) => shop.id === params.get("shop"));
    setShopId(requestedShop?.id || eligibleShops[0]?.id || "");
  }, [eligibleShops, params, shopId]);

  function selectPhotos(event) {
    const selected = Array.from(event.target.files || []);
    const error = validateRepairPhotos(selected, photos.length);
    setPhotoError(error);
    if (!error) setPhotos((current) => [...current, ...selected]);
    event.target.value = "";
  }

  async function submit(event) {
    event.preventDefault();
    if (!selectedShop) return;
    setSubmitted(false);
    setSubmittedRequestId("");
    setSaveError("");
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const appointmentDate = formData.get("date");
    const appointmentTime = formData.get("time");
    if (!emergency && (!isValidDateValue(appointmentDate) || appointmentDate < today || !appointmentTime)) {
      setSaveError(isValidDateValue(appointmentDate) && appointmentDate < today
        ? "Choose today or a future date for your preferred appointment."
        : "Choose a preferred date and time before submitting your request.");
      setIsSubmitting(false);
      return;
    }
    const customer = loadCustomer();
    if (customer?.role !== "customer") {
      setSaveError("Log in with your customer account before submitting a repair request.");
      setIsSubmitting(false);
      return;
    }
    const problemDescription = String(formData.get("issue") || "").trim();
    const urgencyInformation = emergency ? String(formData.get("urgencyInformation") || "").trim() : "";
    const schedulingNotes = String(formData.get("schedulingNotes") || "").trim();
    if (urgencyInformation.length > 1000) {
      setSaveError("Urgency information must be 1000 characters or fewer.");
      setIsSubmitting(false);
      return;
    }
    if (!problemDescription) {
      setSaveError("Describe the problem before submitting your request.");
      setIsSubmitting(false);
      return;
    }
    let requests = [];
    try { requests = parseRequests(localStorage.getItem(requestStorageKey)); }
    catch { setSaveError("Your request could not be saved. Allow browser storage and try again."); setIsSubmitting(false); return; }
    const newRequest = {
      id: `HF-${new Date().getFullYear()}-${window.crypto.randomUUID()}`,
      appliance: service,
      brandModel: formData.get("brandModel") || "",
      serviceType: formData.get("serviceType") || "Home visit",
      contactName: formData.get("fullName") || "",
      phone: formData.get("phone") || "",
      photoCount: photos.length,
      photoNames: photos.map((photo) => photo.name),
      category: service,
      customerName: String(formData.get("fullName") || "").trim(),
      customerPhone: String(formData.get("phone") || "").trim(),
      createdAt: new Date().toISOString(),
      priority: emergency ? "emergency" : "regular",
      urgencyInformation,
      issue: problemDescription,
      shop: selectedShop.name,
      shopId: selectedShop.id,
      location: formData.get("location") || "Phnom Penh",
      date: emergency ? "As soon as possible" : appointmentDate ? new Date(`${appointmentDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "To be confirmed",
      time: emergency ? "Shop to confirm arrival" : appointmentTime,
      preferredDate: emergency ? "As soon as possible" : appointmentDate,
      preferredTime: emergency ? "Shop to confirm arrival" : appointmentTime,
      schedulingNotes,
      status: "Pending",
    };
    {
      const uploadData = new FormData();
      uploadData.append("requestId", newRequest.id);
      uploadData.append("shopId", selectedShop.id);
      uploadData.append("category", service);
      uploadData.append("problemDescription", problemDescription);
      uploadData.append("applianceDetails", String(formData.get("brandModel") || "").trim());
      uploadData.append("contactName", String(formData.get("fullName") || "").trim());
      uploadData.append("contactPhone", String(formData.get("phone") || "").trim());
      uploadData.append("location", String(formData.get("location") || "").trim());
      uploadData.append("serviceType", String(formData.get("serviceType") || "Home visit"));
      uploadData.append("appointmentDate", emergency ? "" : String(appointmentDate || ""));
      uploadData.append("appointmentTime", emergency ? "" : String(appointmentTime || ""));
      uploadData.append("priority", emergency ? "emergency" : "regular");
      uploadData.append("urgencyInformation", urgencyInformation);
      uploadData.append("schedulingNotes", schedulingNotes);
      photos.forEach((photo) => uploadData.append("photos", photo));
      try {
        const response = await fetch("/api/repair-requests", {
          method: "POST",
          credentials: "include",
          body: uploadData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Could not save your repair request.");
        newRequest.id = result.request.id;
        newRequest.status = result.request.status;
        newRequest.customerId = result.request.customerId;
        newRequest.photoAttachments = result.photos;
        setSubmittedRequestId(result.request.id);
      } catch (error) {
        setSaveError(error.message || "Could not connect to the server. Please try again.");
        setIsSubmitting(false);
        return;
      }
    }
    try { saveRequests([newRequest, ...requests]); }
    catch { setSaveError("Your request could not be saved. Allow browser storage and try again."); setIsSubmitting(false); return; }
    setSubmitted(true);
    setIsSubmitting(false);
  }

  return (
    <div className="repair-request-page min-h-screen bg-white text-[#102847]">
      <Header />
      <header className="bg-[#f1f4f8] px-[18px] py-10 md:px-0 md:py-[64px]">
        <div className="mx-auto max-w-[1200px]">
          <h1 className="m-0 text-[32px] font-bold tracking-[-1px] md:text-[40px]">Request a Repair</h1>
          <a href="/my-repair-requests" className="mt-3 inline-flex origin-left text-base font-semibold text-[#315b82] underline-offset-4 transition duration-150 hover:scale-105 hover:text-[#163f6b] hover:underline">View my repair requests</a>
          <p className="mt-3 max-w-[760px] text-[15px] leading-6 text-[#5a6b82]">Tell us what’s broken and when you’re free. We’ll send it to the shop and confirm the visit with you.</p>
        </div>
      </header>
      <main className="mx-auto grid max-w-[1200px] gap-5 px-[18px] py-8 md:grid-cols-[1fr_384px] md:px-0 md:py-12">
        <form className="rounded-2xl border-2 border-[#d6dfea] bg-white p-6 shadow-[0_8px_24px_rgba(11,31,58,.04)] md:p-9" onSubmit={submit}>
          <fieldset className="mb-7"><legend className="text-sm font-bold">How urgent is your repair?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{[false, true].map((urgent) => <label key={String(urgent)} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${urgent && emergency ? "border-red-400 bg-red-50" : !urgent && !emergency ? "border-[#315b82] bg-[#f7faff]" : "border-[#d6dfea]"}`}><input className="mt-1" type="radio" name="priority" value={urgent ? "emergency" : "regular"} checked={emergency === urgent} onChange={() => { setEmergency(urgent); setSubmitted(false); }} /><span><strong className={`block text-sm ${urgent ? "text-red-800" : ""}`}>{urgent ? "Emergency repair" : "Regular repair"}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{urgent ? "Urgent problem. Ask the shop for priority help." : "Choose your preferred appointment."}</span></span></label>)}</div>{emergency && <p role="status" className="mt-3 text-xs leading-5 text-red-800">Your request will be flagged as an emergency. Immediate service and availability are not guaranteed. The shop must confirm whether and when it can help.</p>}</fieldset>
          {!loadCustomer() && <p role="status" className="mb-6 rounded-lg bg-[#edf3f8] p-3 text-sm text-[#315b82]">You need a customer account to submit a repair request. <a className="font-semibold underline" href="/login">Log in</a> or <a className="font-semibold underline" href="/register">create an account</a>.</p>}
          {shopLoadError && <p role="alert" className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{shopLoadError}</p>}
          {emergency && <label className="mb-6 block text-xs font-semibold">Urgency information (optional)<textarea name="urgencyInformation" maxLength={1000} className={`${fieldClass} min-h-24 resize-y`} placeholder="Explain why this needs urgent attention, such as an active leak or when the problem started." /><span className="mt-1 block text-xs font-normal text-slate-500">Up to 1000 characters. This information will be shared with the selected shop.</span></label>}
          <RequestSection number="1" title="What needs fixing?" description="Pick the appliance and describe the problem.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold">Appliance type<select name="appliance" className={fieldClass} value={service} onChange={(event) => { const next = event.target.value; setService(next); setShopId(""); setSubmitted(false); }}>{serviceNames.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-xs font-semibold">Brand / model (optional)<input name="brandModel" maxLength="500" className={fieldClass} placeholder="e.g. Daikin 1.5HP inverter" /></label>
            </div>
            <label className="mt-4 block text-xs font-semibold">Describe the problem<textarea name="issue" required minLength="1" maxLength="2000" className={`${fieldClass} min-h-[118px] resize-y`} placeholder="e.g. AC turns on but blows warm air, and water is dripping from the indoor unit since yesterday." /></label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[#315b82] bg-[#f7faff] p-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-white text-[#315b82]"><Icon name="store" size={17} /></span><span><b className="block text-sm">Add photos of the problem (optional)</b><small className="text-xs text-[#6a7b91]">{photos.length ? `${photos.length} of ${MAX_REPAIR_PHOTOS} photos selected` : "PNG or JPG · up to 5 photos · 5 MB each"}</small></span></div><label className="cursor-pointer rounded-lg border-2 border-[#123b66] px-3 py-2 text-xs font-semibold text-[#123b66]">Browse files<input className="sr-only" type="file" accept={REPAIR_PHOTO_ACCEPT} multiple onChange={selectPhotos} /></label></div>
            {photoError && <p role="alert" className="mt-2 text-xs text-red-700">{photoError}</p>}
            {photos.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{photos.map((photo, index) => <li key={`${photo.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-[#edf3f8] px-2 py-1 text-xs"><span className="max-w-48 truncate">{photo.name}</span><button type="button" aria-label={`Remove ${photo.name}`} onClick={() => { setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index)); setPhotoError(""); }} className="font-bold text-[#315b82]">×</button></li>)}</ul>}
          </RequestSection>
          <RequestSection number="2" title="Where and when?" description="Choose a time that works for you.">
            <label className="block text-xs font-semibold">Address<input name="location" required maxLength="500" className={fieldClass} defaultValue="House 12, Street 271, Toul Kork" /></label>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold">Preferred date<input name="date" type="date" min={today} className={fieldClass} defaultValue={tomorrow} /></label><label className="text-xs font-semibold">Preferred time<select name="time" className={fieldClass} defaultValue="Morning (8:00 – 12:00)"><option>Morning (8:00 – 12:00)</option><option>Afternoon (12:00 – 17:00)</option><option>Evening (17:00 – 20:00)</option></select></label></div>
            <label className="mt-4 block text-xs font-semibold">Scheduling notes (optional)<textarea name="schedulingNotes" maxLength={500} className={`${fieldClass} min-h-20 resize-y`} placeholder="e.g. I'm free after 2 pm on weekdays. Please call 30 minutes before arriving." /><span className="mt-1 block text-xs font-normal text-slate-500">Up to 500 characters, shared with the shop.</span></label>
            <p className="mb-0 mt-3 rounded-lg bg-[#edf3f8] p-3 text-xs leading-5 text-[#315b82]">Your preferred date and time are a request, not a confirmed booking. The shop will confirm the actual appointment. You can change your preference until the shop responds.</p>
            <fieldset className="mt-4"><legend className="text-xs font-semibold">Service type</legend><div className="mt-2 flex flex-wrap gap-5 text-xs text-[#5a6b82]"><label className="flex items-center gap-2"><input type="radio" name="serviceType" value="Home visit" defaultChecked /> Home visit – technician comes to me</label><label className="flex items-center gap-2"><input type="radio" name="serviceType" value="In-shop repair" /> I’ll bring it to the shop</label></div></fieldset>
          </RequestSection>
          <RequestSection number="3" title="Your contact details" description="So the shop and our team can reach you.">
            <div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold">Full name<input name="fullName" required maxLength="120" className={fieldClass} placeholder="Your full name" defaultValue={loadCustomer()?.name || ""} /></label><label className="text-xs font-semibold">Phone number<input name="phone" required type="tel" maxLength="40" inputMode="tel" title="Enter a valid Cambodian phone number, for example 012 345 678" className={fieldClass} placeholder="012 345 678" defaultValue={loadCustomer()?.phone || ""} /></label></div>
            <label className="mt-4 flex items-center gap-2 text-xs text-[#233b57]"><input type="checkbox" required defaultChecked /> I agree to be contacted by HomeFix and the repair shop about this request.</label>
          </RequestSection>
          {saveError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
          {submitted && selectedShop && <p role="status" className="rounded-lg bg-[#e3f4ec] p-3 text-sm text-[#226b50]">Request submitted to {selectedShop.name}. Your request ID is {submittedRequestId}.{emergency ? " Immediate service and availability are not guaranteed; the shop must confirm whether and when it can help." : " Your preferred time is a request; the shop will confirm the actual appointment."}</p>}
          <div className="mt-6 flex justify-end gap-4"><a href="/" className="self-center text-sm text-[#123b66]">Cancel</a><button disabled={!selectedShop || shopsLoading || isSubmitting || Boolean(photoError) || !loadCustomer()} className="disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2 rounded-lg bg-[#123b66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0c2e53]" type="submit">{isSubmitting ? "Submitting…" : "Submit Request"}</button></div>
        </form>
        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border-2 border-[#d6dfea] p-6"><label className="block text-xs font-bold tracking-[.08em] text-[#315b82]" htmlFor="request-shop">REQUESTING FROM</label><select id="request-shop" required className={fieldClass} value={selectedShop?.id || ""} onChange={(event) => { setShopId(event.target.value); setSubmitted(false); }}><option value="" disabled>{shopsLoading ? "Loading approved shops…" : "Select an approved shop"}</option>{eligibleShops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>{selectedShop ? <><p className="mt-4 text-sm font-semibold">{selectedShop.name}</p><p className="mt-2 text-xs text-[#6a7b91]">{selectedShop.location}</p><p className="mt-3 text-xs text-[#258a62]">Supports {service}</p></> : <p role="status" className="mt-4 text-sm text-[#6a7b91]">{eligibleShops.length ? "Choose a shop that supports this service." : "No approved shops currently match this category and urgency. Try a regular request or another service."}</p>}</section>
          <section className="rounded-2xl border-2 border-[#d6dfea] p-6"><h2 className="m-0 text-base font-bold">What happens next</h2><ol className="mt-4 grid gap-4 text-xs leading-5 text-[#6a7b91]"><li><b className="mr-2 inline-grid size-5 place-items-center rounded-full bg-[#e3edf7] text-[#315b82]">1</b>Your request is saved for the selected shop to review.</li><li><b className="mr-2 inline-grid size-5 place-items-center rounded-full bg-[#e3edf7] text-[#315b82]">2</b>The shop reviews your request and decides whether it can accept it.</li><li><b className="mr-2 inline-grid size-5 place-items-center rounded-full bg-[#e3edf7] text-[#315b82]">3</b>The shop must confirm service timing and availability with you.</li></ol></section>
          <section className="rounded-2xl bg-[#fde7e5] p-6"><h2 className="m-0 text-base font-bold">⚠ Can’t wait?</h2><p className="text-xs leading-5 text-[#6a6f7b]">Mark your request as an emergency to explain its urgency to an eligible shop. Immediate service and availability are not guaranteed.</p><button type="button" onClick={() => { setEmergency(true); setSubmitted(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex rounded-lg bg-[#c9343b] px-3 py-2 text-xs font-semibold text-white">☎ Emergency Service</button></section>
        </aside>
      </main>
      <Footer />
    </div>
  );
}

function RequestSection({ number, title, description, children }) {
  return <section className="border-b-2 border-[#d6dfea] py-1 pb-6 pt-0 first:pt-0 last:border-0 last:pb-0 [&+section]:mt-6"><div className="mb-5 flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#123b66] text-xs font-bold text-white">{number}</span><div><h2 className="m-0 text-base font-bold">{title}</h2><p className="m-0 text-xs text-[#6a7b91]">{description}</p></div></div>{children}</section>;
}
