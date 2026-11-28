import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import Icon from "../components/Icon.jsx";
import useRepairRequests from "../context/useRepairRequests.js";
import RequestStatusBadge from "../components/RequestStatusBadge.jsx";
import { StatusHistory } from "../components/RequestStatusActions.jsx";
import { requestStatus } from "../data/ownerRequests.js";
import { loadCustomer } from "../data/customerAccount.js";
import { REPAIR_PHOTO_ACCEPT, validateRepairPhotos } from "../data/repairPhotos.js";

export default function RepairRequestDetailsPage() {
  const { requestId } = useParams();
  const { requests, error, loading } = useRepairRequests();
  const request = requests.find((item) => item.id === requestId);
  const [photosByRequest, setPhotosByRequest] = useState({});
  const photos = photosByRequest[requestId] || request?.photoAttachments || [];
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let active = true;
    setPendingPhotos([]);
    setPhotoError("");
    if (!request || loadCustomer()?.role !== "customer") return () => { active = false; };
    fetch(`/api/repair-requests/${encodeURIComponent(request.id)}/photos`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 404 || response.status === 401) return null;
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Could not load photos.");
        return result;
      })
      .then((result) => {
        if (active && result) setPhotosByRequest((current) => ({ ...current, [request.id]: result }));
      })
      .catch((error) => { if (active) setPhotoError(error.message); });
    return () => { active = false; };
  }, [requestId, request?.id]);

  function selectPhotos(event) {
    const selected = Array.from(event.target.files || []);
    const error = validateRepairPhotos(selected, photos.length + pendingPhotos.length);
    setPhotoError(error);
    if (!error) setPendingPhotos((current) => [...current, ...selected]);
    event.target.value = "";
  }

  async function uploadPhotos() {
    if (loadCustomer()?.role !== "customer") {
      setPhotoError("Log in with your customer account to add photos.");
      return;
    }
    if (!pendingPhotos.length) {
      setPhotoError("Choose at least one PNG or JPG photo to upload.");
      return;
    }
    setIsUploading(true);
    setPhotoError("");
    const formData = new FormData();
    pendingPhotos.forEach((photo) => formData.append("photos", photo));
    try {
      const response = await fetch(`/api/repair-requests/${encodeURIComponent(request.id)}/photos`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not upload photos.");
      setPhotosByRequest((current) => ({
        ...current,
        [request.id]: [...(current[request.id] || request.photoAttachments || []), ...result.photos],
      }));
      setPendingPhotos([]);
    } catch (error) {
      setPhotoError(error.message || "Could not connect to the server. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-[#f0f4f9] text-navy">
        <Header />
        <main className="mx-auto max-w-[760px] px-[18px] py-16 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="search" size={22}/></span>
          <h1 className="mb-2 mt-4 text-2xl font-bold">{loading ? "Loading request" : "Request not found"}</h1>
          <p className="m-0 text-sm text-[#718197]">{loading ? "Loading request..." : error || "This request is unavailable for your account."}</p>
          <Link className="mt-5 inline-flex rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white" to="/my-repair-requests">Back to my requests</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const statusDescription = {
    Incoming: "Your request is waiting for shop confirmation.",
    Accepted: "The shop has accepted your repair request.",
    "In progress": "The shop is working on your repair.",
    Completed: "This repair request has been completed.",
    Rejected: "The shop could not accept your request.",
    Cancelled: "This repair request has been cancelled.",
  }[requestStatus(request.status)] || "Your request has been received.";
  return (
    <div className="min-h-screen bg-[#f0f4f9] text-navy">
      <Header />
      <section className="bg-white px-[18px] py-8 md:py-10">
        <div className="mx-auto max-w-[1000px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {request.emergency && <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#cf3b42] px-2.5 py-1 text-[11px] font-bold text-white"><Icon name="alert" size={12}/>Emergency request</span>}
              <p className="mb-1 mt-0 text-xs font-semibold tracking-wide text-[#718197]">REQUEST {request.id}</p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-1px] md:text-[36px]">{request.appliance || "Home repair"}</h1>
              <p className="mb-0 mt-2 text-sm text-[#64758b]">Submitted {request.date || "recently"} · {request.time || "Appointment to be confirmed"}</p>
            </div>
            <RequestStatusBadge status={request.status || "Awaiting confirmation"} />
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1000px] gap-5 px-[18px] py-7 md:grid-cols-[minmax(0,1fr)_320px] md:py-9">
        <div className="grid content-start gap-4">
          <section className="rounded-xl border border-[#dbe3ec] bg-white p-5 md:p-6">
            <h2 className="m-0 text-base font-bold">Repair details</h2>
            <p className="mb-0 mt-3 whitespace-pre-wrap text-sm leading-6 text-[#52657b]">{request.issue || "No problem description was provided."}</p>
            {request.brandModel && <p className="mb-0 mt-3 text-sm text-[#64758b]"><strong className="text-[#263e58]">Brand / model:</strong> {request.brandModel}</p>}
            {(photos.length > 0 || request.photoNames?.length > 0) && <div className="mt-4 border-t border-[#edf0f4] pt-3">
              <h3 className="m-0 text-xs font-bold">Attached photos</h3>
              {photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo) => <figure key={photo.id || photo.name} className="m-0"><img className="aspect-square w-full rounded-lg border border-[#dbe3ec] bg-[#f0f4f9] object-cover" src={photo.url} alt={`Photo attached to request ${request.id}`} loading="lazy" referrerPolicy="no-referrer" /><figcaption className="mt-1 truncate text-xs text-[#52657b]">{photo.name}</figcaption></figure>)}</div>}
              {request.photoNames?.length > 0 && <ul className="mb-0 mt-2 grid gap-1 pl-5 text-xs text-[#52657b]">{request.photoNames.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul>}
            </div>}
            {loadCustomer()?.role === "customer" && <div className="mt-4 border-t border-[#edf0f4] pt-3">
              <h3 className="m-0 text-xs font-bold">Add photos</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input aria-label="Choose PNG or JPG photos" type="file" accept={REPAIR_PHOTO_ACCEPT} multiple onChange={selectPhotos} className="max-w-full text-xs" />
                <button type="button" disabled={!pendingPhotos.length || isUploading || Boolean(photoError)} onClick={uploadPhotos} className="rounded-lg bg-[#163f6b] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{isUploading ? "Uploading…" : `Upload ${pendingPhotos.length || ""} photos`}</button>
              </div>
              {pendingPhotos.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{pendingPhotos.map((photo, index) => <li key={`${photo.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-[#edf3f8] px-2 py-1 text-xs"><span className="max-w-40 truncate">{photo.name}</span><button type="button" aria-label={`Remove ${photo.name}`} onClick={() => { setPendingPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index)); setPhotoError(""); }} className="font-bold text-[#315b82]">×</button></li>)}</ul>}
              {photoError && <p role="alert" className="mt-2 text-xs text-red-700">{photoError}</p>}
            </div>}
          </section>
          <section className="rounded-xl border border-[#dbe3ec] bg-white p-5 md:p-6">
            <h2 className="mb-4 mt-0 text-base font-bold">Appointment and service</h2>
            <DetailRow icon="store" label="Selected shop" value={request.shop || "Not assigned yet"} />
            <DetailRow icon="calendar" label="Preferred appointment" value={`${request.date || "To be confirmed"} · ${request.time || "To be confirmed"}`} />
            <DetailRow icon="home" label="Service type" value={request.serviceType || (request.emergency ? "Emergency response" : "Home visit")} />
            <DetailRow icon="pin" label="Service address" value={request.location || "Not provided"} />
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className={`rounded-xl border bg-white p-5 ${request.emergency ? "border-[#efb7ba]" : "border-[#dbe3ec]"}`}>
            <h2 className="mb-2 mt-0 text-sm font-bold">Request status</h2>
            <RequestStatusBadge status={request.status || "Awaiting confirmation"} />
            <p className="mb-0 mt-3 text-xs leading-5 text-[#64758b]">{statusDescription}</p>
            {request.rejectionReason && <p className="mt-3 text-xs text-red-700"><strong>Rejection reason:</strong> {request.rejectionReason}</p>}
            <StatusHistory entries={request.statusHistory || []} />
            {request.cancellationReason && <p className="mb-0 mt-3 text-xs leading-5 text-[#64758b]"><strong>Cancellation reason:</strong> {request.cancellationReason}{request.cancellationDetails ? ` (${request.cancellationDetails})` : ""}</p>}
            {request.updatedAt && <p className="mb-0 mt-3 text-[11px] text-[#718197]">Last updated {request.updatedAt}</p>}
          </section>
          {request.contactName || request.phone ? (
            <section className="rounded-xl border border-[#dbe3ec] bg-white p-5">
              <h2 className="mb-3 mt-0 text-sm font-bold">Contact details</h2>
              {request.contactName && <DetailRow icon="user" label="Name" value={request.contactName} />}
              {request.phone && <a className="flex items-center gap-2.5 py-2 text-xs font-semibold text-[#315b82] hover:underline" href={`tel:${request.phone.replace(/[\s()-]/g, "")}`}><Icon name="phone" size={15}/>{request.phone}</a>}
            </section>
          ) : null}
          <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#315b82] bg-white px-4 text-sm font-semibold text-[#315b82] hover:bg-[#f8fafc]" to="/my-repair-requests">
            Back to my requests
          </Link>
          {request.shop && <Link className="text-center text-xs font-semibold text-[#315b82] hover:underline" to={`/repair-shops/${request.shop.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}>View selected shop</Link>}
        </aside>
      </main>
      <Footer />
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-[#edf0f4] py-3 first:border-0 first:pt-0 last:pb-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e8eef5] text-[#315b82]"><Icon name={icon} size={15}/></span>
      <span><small className="block text-xs text-[#718197]">{label}</small><b className="mt-0.5 block text-sm leading-5">{value}</b></span>
    </div>
  );
}
