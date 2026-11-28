import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import Icon from "../components/Icon.jsx";
import ShopCard from "../components/ShopCard.jsx";
import { loadCustomer } from "../data/customerAccount.js";
import { MAX_REPAIR_PHOTOS, REPAIR_PHOTO_ACCEPT, validateRepairPhotos } from "../data/repairPhotos.js";

const emergencyTypes = [
  { title: "Power outage or sparks", detail: "Breakers tripping, burning smell, exposed wires.", icon: "bolt" },
  { title: "Water leak or burst pipe", detail: "Leaking pipes, flooding, broken water heater.", icon: "drop" },
  { title: "AC breakdown", detail: "Not cooling, leaking, or making loud noises.", icon: "snow" },
  { title: "Fridge stopped cooling", detail: "Explain the urgency of a cooling failure.", icon: "fridge" },
];

export default function EmergencyServicePage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [category, setCategory] = useState("Electrical");
  const [approvedShops, setApprovedShops] = useState([]);
  const [shopId, setShopId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emergencyShops = approvedShops.filter((shop) => shop.supportsEmergency === true);
  const eligibleShops = emergencyShops.filter((shop) => shop.category === category);
  const selectedShop = eligibleShops.find((shop) => shop.id === shopId);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/shops", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Could not load approved repair shops.");
        setApprovedShops(result);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load approved repair shops.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (eligibleShops.some((shop) => shop.id === shopId)) return;
    setShopId(eligibleShops[0]?.id || "");
  }, [eligibleShops, shopId]);

  function selectPhotos(event) {
    const selected = Array.from(event.target.files || []);
    const validationError = validateRepairPhotos(selected, photos.length);
    setPhotoError(validationError);
    if (!validationError) setPhotos((current) => [...current, ...selected]);
    event.target.value = "";
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = event.currentTarget;
    setError("");
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const issue = String(formData.get("issue") || "").trim();
    const urgencyInformation = String(formData.get("urgencyInformation") || "").trim();
    if (urgencyInformation.length > 1000) {
      setError("Urgency information must be 1000 characters or fewer.");
      return;
    }
    const isEmergency = formData.get("isEmergency") === "on";

    if (!fullName || !phone || !location || !issue) {
      setError("Please complete all required fields before submitting.");
      setSubmitted(false);
      return;
    }
    if (!isEmergency) {
      setError("Emergency requests must be marked as urgent.");
      setSubmitted(false);
      return;
    }
    if (!selectedShop) {
      setError("Choose an approved shop that offers emergency services for this category.");
      setSubmitted(false);
      return;
    }
    if (loadCustomer()?.role !== "customer") {
      setError("Log in with your customer account before submitting an emergency request.");
      setSubmitted(false);
      return;
    }
    setIsSubmitting(true);

    const request = {
      id: `EM-${new Date().getFullYear()}-${window.crypto.randomUUID()}`,
      appliance: category,
      issue,
      shop: selectedShop.name,
      location,
      date: "Timing to be confirmed",
      time: "Subject to shop availability",
      status: "Emergency - Awaiting response",
      createdAt: new Date().toISOString(),
      emergency: true,
      priority: "emergency",
      urgencyInformation,
      contactName: fullName,
      phone,
      photoCount: photos.length,
      photoNames: photos.map((photo) => photo.name),
      shopId: selectedShop.id,
    };

    {
      const uploadData = new FormData();
      uploadData.append("requestId", request.id);
      uploadData.append("shopId", request.shopId);
      uploadData.append("category", category);
      uploadData.append("problemDescription", issue);
      uploadData.append("contactName", fullName);
      uploadData.append("contactPhone", phone);
      uploadData.append("location", location);
      uploadData.append("serviceType", "Home visit");
      uploadData.append("appointmentDate", "");
      uploadData.append("appointmentTime", "");
      uploadData.append("priority", "emergency");
      uploadData.append("urgencyInformation", urgencyInformation);
      photos.forEach((photo) => uploadData.append("photos", photo));
      try {
        const response = await fetch("/api/repair-requests", {
          method: "POST",
          credentials: "include",
          body: uploadData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Could not save your emergency request.");
        request.id = result.request.id;
        request.status = result.request.status;
        request.photoAttachments = result.photos;
      } catch (requestError) {
        setError(requestError.message || "Could not connect to the server. Please try again.");
        setIsSubmitting(false);
        setSubmitted(false);
        return;
      }
    }

    try {
      const saved = JSON.parse(localStorage.getItem("homefix-repair-requests") || "[]");
      localStorage.setItem("homefix-repair-requests", JSON.stringify([request, ...saved]));
    } catch { /* The request is already saved in the database. */ }
    setError("");
    setSubmitted(true);
    form.reset();
    setPhotos([]);
    setCategory("Electrical");
    setIsSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-white text-navy">
      <Header />
      <main>
        <section className="bg-[#153b64] text-white">
          <div className="mx-auto grid min-h-[390px] w-[calc(100%-36px)] max-w-[1200px] items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-12">
            <div className="max-w-[540px]">
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-white/20 bg-[#4e6680] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.04em]">
                <Icon name="alert" size={13} /> Emergency repair requests
              </span>
              <h1 className="mb-4 mt-6 text-[38px] font-extrabold leading-[1.08] tracking-[-1.7px] md:text-[43px]">
                Something broke?<br />Request urgent repair help.
              </h1>
              <p className="max-w-[540px] text-[15px] leading-[1.75] text-[#cbd7e5]">
                Send an urgent request to a shop that offers emergency services. Immediate service and availability are not guaranteed. The shop must confirm whether and when it can help.
              </p>
            </div>

            <form id="emergency-request-form" className="rounded-[18px] bg-white p-5 text-navy shadow-[0_18px_40px_rgba(6,24,48,.18)] md:p-6" onSubmit={submitRequest}>
              <h2 className="m-0 text-[16px] font-bold">Quick emergency request</h2>
              <p className="mb-4 mt-1 text-[11px] text-[#718198]">Response time depends on the shop. Immediate service and availability are not guaranteed.</p>
              {submitted && (
                <p className="mb-3 rounded-lg bg-[#e7f5ed] px-3 py-2 text-[12px] font-semibold text-[#24744f]" role="status">
                  Emergency request submitted. The shop must review and accept it. Immediate service and availability are not guaranteed.
                </p>
              )}
              {error && (
                <p className="mb-3 rounded-lg bg-[#fff0ef] px-3 py-2 text-[12px] font-semibold text-[#a62b31]" role="alert">
                  {error}
                </p>
              )}
              {photoError && <p className="mb-3 rounded-lg bg-[#fff0ef] px-3 py-2 text-[12px] font-semibold text-[#a62b31]" role="alert">{photoError}</p>}
              <label className="block text-[11px] font-bold">Appliance category <span className="text-[#c9343b]">*</span></label>
              <div className="relative mt-1.5">
                <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#315b82]" name="bolt" size={14} />
                <select name="category" required value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full appearance-none rounded-lg border-2 border-[#d6dfea] bg-white pl-9 pr-8 text-[12px] text-[#354b63] outline-none focus:border-[#315b82]">
                  <option>Electrical</option>
                  <option>Plumbing</option>
                  <option>Air Conditioner</option>
                  <option>Refrigerator</option>
                  <option>TV &amp; Electronics</option>
                  <option>Washing Machine</option>
                  <option>Other appliance</option>
                </select>
              </div>
              <label className="mt-3 block text-[11px] font-bold">Repair shop <span className="text-[#c9343b]">*</span></label>
              <select name="shopId" required value={selectedShop?.id || ""} onChange={(event) => setShopId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border-2 border-[#d6dfea] bg-white px-3 text-[12px] outline-none focus:border-[#315b82]">
                <option value="" disabled>{eligibleShops.length ? "Select an approved shop" : "No emergency-enabled shops for this category"}</option>
                {eligibleShops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
              </select>
              <label className="mt-3 block text-[11px] font-bold">Describe the appliance problem <span className="text-[#c9343b]">*</span></label>
              <textarea name="issue" required minLength={1} maxLength={2000} className="mt-1.5 min-h-[76px] w-full resize-none rounded-lg border-2 border-[#d6dfea] px-3 py-2.5 text-[12px] outline-none placeholder:text-[#8795a5] focus:border-[#315b82]" placeholder="e.g. Breaker keeps tripping and has a burning smell." />
              <label className="mt-3 block text-[11px] font-bold">Urgency information (optional)<textarea name="urgencyInformation" maxLength={1000} className="mt-1.5 min-h-[76px] w-full rounded-lg border-2 border-[#d6dfea] px-3 py-2.5 text-[12px]" placeholder="Why does this need urgent attention? Up to 1000 characters." /></label>
              <label className="mt-3 block text-[11px] font-bold">Repair location <span className="text-[#c9343b]">*</span></label>
              <div className="relative mt-1.5">
                <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#315b82]" name="pin" size={14} />
                <input name="location" required className="h-10 w-full rounded-lg border-2 border-[#d6dfea] pl-9 pr-3 text-[12px] outline-none placeholder:text-[#8795a5] focus:border-[#315b82]" placeholder="Street, district or use my location" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[11px] font-bold">Full name <span className="text-[#c9343b]">*</span><input name="fullName" required className="mt-1.5 h-10 w-full rounded-lg border-2 border-[#d6dfea] px-3 text-[12px] outline-none placeholder:text-[#8795a5] focus:border-[#315b82]" placeholder="Your name" /></label>
                <label className="text-[11px] font-bold">Phone number <span className="text-[#c9343b]">*</span><input name="phone" required type="tel" className="mt-1.5 h-10 w-full rounded-lg border-2 border-[#d6dfea] px-3 text-[12px] outline-none placeholder:text-[#8795a5] focus:border-[#315b82]" placeholder="012 345 675" /></label>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border-2 border-dashed border-[#d6dfea] px-3 py-2.5">
                <span className="text-[10px] leading-4 text-[#718198]">{photos.length ? `${photos.length} of ${MAX_REPAIR_PHOTOS} photos selected` : "PNG or JPG · 5 MB each (optional)"}</span>
                <label className="cursor-pointer whitespace-nowrap rounded-md border-2 border-[#315b82] px-2.5 py-1.5 text-[10px] font-semibold text-[#315b82]">Browse<input className="sr-only" type="file" accept={REPAIR_PHOTO_ACCEPT} multiple onChange={selectPhotos} /></label>
              </div>
              {photos.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{photos.map((photo, index) => <li key={`${photo.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-[#edf3f8] px-2 py-1 text-[10px]"><span className="max-w-36 truncate">{photo.name}</span><button type="button" aria-label={`Remove ${photo.name}`} onClick={() => { setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index)); setPhotoError(""); }} className="font-bold text-[#315b82]">×</button></li>)}</ul>}
              <label className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-[#52657b]">
                <input name="isEmergency" type="checkbox" required defaultChecked className="mt-0.5 size-3.5 accent-[#c9343b]" />
                <span>Mark this as an <strong className="text-[#b52d34]">Emergency request</strong>.</span>
              </label>
              {submitted && (
                <a className="mt-3 inline-flex text-[11px] font-semibold text-[#315b82] underline" href="/my-repair-requests">
                  View this request in My Repair Requests
                </a>
              )}
              <button disabled={isSubmitting || Boolean(photoError) || !selectedShop} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#cf3b42] text-[12px] font-bold text-white hover:bg-[#b92f36] disabled:opacity-60" type="submit">
                <Icon name="alert" size={15} /> {isSubmitting ? "Submitting…" : "Request urgent help"}
              </button>
            </form>
          </div>
        </section>

        <section className="bg-white py-10 md:py-12">
          <div className="mx-auto w-[calc(100%-36px)] max-w-[1200px]">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#315b82]">We can help with</p>
            <h2 className="m-0 text-[26px] font-bold tracking-[-1px]">Common home emergencies</h2>
            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {emergencyTypes.map((item) => (
                <article className="rounded-[12px] border-2 border-[#dde5ed] p-5" key={item.title}>
                  <span className="grid size-[40px] place-items-center rounded-[9px] bg-[#f7dfe1] text-[#c9343b]">
                    <Icon name={item.icon} size={20} />
                  </span>
                  <h3 className="mb-1 mt-4 text-[14px] font-bold">{item.title}</h3>
                  <p className="m-0 text-[11px] leading-[1.6] text-[#718198]">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f0f4f9] py-10 md:py-12">
          <div className="mx-auto w-[calc(100%-36px)] max-w-[1200px]">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#315b82]">Subject to availability</p>
                <h2 className="m-0 text-[26px] font-bold tracking-[-1px]">Shops offering emergency visits</h2>
              </div>
              <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border-2 border-[#315b82] px-4 text-[12px] font-semibold bg-[#315b82] text-white hover:bg-[#244b70]" href="/repair-shops">
                See all shops
              </a>
            </div>
            {!emergencyShops.length && <p role="status" className="text-sm text-slate-500">No approved shops currently offer emergency services. Please check again later or submit a regular repair request.</p>}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {emergencyShops.map((shop) => (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  onDetails={(selected) => navigate(`/request-repair?priority=emergency&shop=${encodeURIComponent(selected.id)}&category=${encodeURIComponent(selected.category)}`)}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
