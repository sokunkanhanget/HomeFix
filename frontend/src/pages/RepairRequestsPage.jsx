import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Icon from "../components/Icon.jsx";
import useRepairRequests from "../context/useRepairRequests.js";
import RequestStatusBadge, { EmergencyBadge } from "../components/RequestStatusBadge.jsx";
import { isEmergencyRequest, lastStatusUpdate, recordStatusChange, requestStatus, requestTimeline } from "../data/ownerRequests.js";
import { StatusHistory } from "../components/RequestStatusActions.jsx";

const filters = ["All requests", "Emergency", "Upcoming", "Completed", "Rejected", "Cancellation requested"];

export default function RepairRequestsPage() {
  const { requests, error, updateRequest } = useRepairRequests();
  const [actionError, setActionError] = useState("");
  const notifications = requests.flatMap((request) => (Array.isArray(request.notifications) ? request.notifications : [])
    .filter((notification) => !notification.read).map((notification) => ({ ...notification, requestId: request.id })))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const [activeFilter, setActiveFilter] = useState("All requests");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [cancelledId, setCancelledId] = useState("");

  const visibleRequests = useMemo(() => requests.filter((request) => {
    if (activeFilter === "Emergency") return isEmergencyRequest(request);
    if (activeFilter === "Upcoming") return ["Incoming", "Accepted", "In progress"].includes(requestStatus(request.status));
    if (activeFilter === "Rejected") return request.status === "Rejected";
    if (activeFilter === "Completed") return request.status === "Completed";
    if (activeFilter === "Cancellation requested") return request.status === "Cancellation requested";
    return true;
  }), [requests, activeFilter]);

  function submitCancellation(event) {
    event.preventDefault();
    try {
      updateRequest(selectedRequest.id, (request) => {
        if (!["Incoming", "Accepted"].includes(requestStatus(request.status))) throw new Error("This request has changed and can no longer be cancelled.");
        return recordStatusChange(request, "Cancellation requested", undefined, { cancellationReason: reason, cancellationDetails: details });
      });
      setActionError("");
    } catch { setActionError("Cancellation could not be saved. The request may have changed, or browser storage is unavailable."); return; }
    setCancelledId(selectedRequest.id);
    setSelectedRequest(null);
    setReason("");
    setDetails("");
  }

  return <div className="repair-requests-page min-h-screen bg-[#f0f4f9] text-[#102847]"><Header />
    <section className="bg-white px-[18px] py-8 md:py-10"><div className="mx-auto max-w-[1100px]"><nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[#60748d]"><Link to="/">Home</Link><span>›</span><span className="font-semibold text-[#102847]">My Repair Requests</span></nav><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="m-0 text-[30px] font-bold tracking-[-1px] md:text-[36px]">My Repair Requests</h1><p className="mb-0 mt-2 text-sm text-[#64758b]">Track your appointments and manage your repair requests.</p></div><Link to="/request-repair" className="request-list-primary inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#163f6b] px-4 text-sm font-semibold text-white"><Icon name="wrench" size={15}/>Request a Repair</Link></div></div></section>
    <main className="mx-auto max-w-[1100px] px-[18px] py-7 md:py-9">
      {(error || actionError) && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error || actionError}</p>}
      {notifications.length > 0 && <section aria-labelledby="request-notifications" className="mb-6 rounded-xl border border-blue-200 bg-white p-5"><h2 id="request-notifications" className="flex items-center gap-2 text-lg font-bold"><Icon name="message" size={20} />Request updates <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-800">{notifications.length} unread</span></h2><div role="status" aria-live="polite" className="mt-4 grid gap-3">{notifications.map((notification) => <div key={notification.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-blue-50 p-4"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#315b82]">{notification.requestId} · {new Date(notification.createdAt).toLocaleString()}</p><p className="mt-2 break-words text-sm leading-6">{notification.message}</p></div><button type="button" aria-label={`Mark ${notification.status} update for ${notification.requestId} as read`} onClick={() => { try { updateRequest(notification.requestId, (request) => ({ ...request, notifications: request.notifications.map((item) => item.id === notification.id ? { ...item, read: true } : item) })); setActionError(""); } catch { setActionError("The notification could not be marked as read. Please try again."); } }} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-[#315b82]">Mark as read</button></div>)}</div><p className="mt-4 text-xs text-slate-500">Demo in-app notifications sync in this browser. SMS and email delivery require backend integration.</p></section>}
      <div className="mb-5 flex flex-wrap gap-2">{filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${activeFilter === filter ? "border-[#163f6b] bg-[#163f6b] text-white" : "border-[#d6dfea] bg-white text-[#52657b] hover:bg-[#f8fafc]"}`}>{filter}</button>)}</div>
      {cancelledId && <div role="status" className="mb-5 flex items-center gap-2 rounded-lg border border-[#cce8d7] bg-[#effaf3] p-4 text-sm text-[#216746]"><Icon name="check" size={17}/>Cancellation requested for {cancelledId}. HomeFix will contact you with an update.</div>}
      {visibleRequests.length ? <div className="grid gap-4">{visibleRequests.map((request) => <article key={request.id} className="rounded-xl border border-[#dbe3ec] bg-white p-5 shadow-[0_3px_12px_rgba(16,40,71,.04)] md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-1 mt-0 text-xs font-semibold tracking-wide text-[#718197]">REQUEST {request.id}</p><h2 className="m-0 text-lg font-bold">{request.appliance}</h2><p className="mb-0 mt-1 text-sm text-[#64758b]">{request.issue}</p>{lastStatusUpdate(request) && <p className="mb-0 mt-1 text-xs text-[#718197]">Last updated {new Date(lastStatusUpdate(request)).toLocaleString()}</p>}</div><div className="flex flex-wrap gap-2">{isEmergencyRequest(request) && <EmergencyBadge />}<RequestStatusBadge status={request.status}/></div></div><div className="mt-5 grid gap-4 border-t border-[#edf0f4] pt-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Repair shop" value={request.shop} icon="store"/><Info label="Appointment" value={request.time === "Completed" ? "Completed" : `${request.date} · ${request.time}`} icon="calendar"/><Info label="Service location" value={request.location} icon="pin"/><Info label="Request number" value={request.id} icon="check"/></div>{request.rejectionReason && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"><strong>Rejection reason:</strong> {request.rejectionReason}</p>}<StatusHistory entries={requestTimeline(request)} className="mt-4 text-xs text-[#718197]" /><div className="mt-5 flex flex-wrap justify-end gap-2">{["Incoming", "Accepted"].includes(requestStatus(request.status)) && <button type="button" onClick={() => { setSelectedRequest(request); setCancelledId(""); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c9343b] px-4 text-sm font-semibold text-[#b52d34] hover:bg-[#fff7f6]"><Icon name="check" size={15}/>Cancel request</button>}<Link to={`/repair-shops/${request.shop.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d6dfea] px-4 text-sm font-semibold text-[#315b82] hover:bg-[#f8fafc]">View shop</Link></div></article>)}</div> : <section className="rounded-xl border border-dashed border-[#cbd7e3] bg-white px-5 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="calendar" size={22}/></span><h2 className="mb-2 mt-4 text-lg font-bold">No requests in this section</h2><p className="m-0 text-sm text-[#718197]">Try another filter or start a new repair request.</p><Link className="request-list-primary mt-4 inline-flex rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white" to="/request-repair">Request a Repair</Link></section>}
    </main>
    <Footer />
    {selectedRequest && <div className="fixed inset-0 z-30 grid place-items-center bg-[#09192c]/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRequest(null); }}><form role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" onSubmit={submitCancellation} className="w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-semibold text-[#718197]">{selectedRequest.id}</span><h2 id="cancel-dialog-title" className="mb-0 mt-1 text-xl font-bold">Cancel this repair request?</h2><p className="mb-0 mt-2 text-sm text-[#64758b]">{selectedRequest.appliance} · {selectedRequest.shop}</p></div><button type="button" aria-label="Close" onClick={() => setSelectedRequest(null)} className="grid size-9 place-items-center rounded-full bg-[#f0f4f8] text-lg text-[#52657b]">×</button></div><label className="mt-5 block text-sm font-semibold">Reason for cancellation<select required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d6dfea] bg-white px-3 py-3 text-sm font-normal"><option value="">Choose a reason</option><option>Issue is already fixed</option><option>I need to reschedule</option><option>I chose another repair shop</option><option>Other</option></select></label><label className="mt-4 block text-sm font-semibold">Additional details <span className="font-normal text-[#718197]">(optional)</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[#d6dfea] px-3 py-3 text-sm font-normal outline-none focus:border-[#315b82]" placeholder="Add a note for our team"/></label><p className="mt-4 rounded-lg bg-[#fff7f6] p-3 text-xs leading-5 text-[#8a5555]">Your appointment remains scheduled until HomeFix confirms the cancellation.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSelectedRequest(null)} className="rounded-lg border border-[#d6dfea] px-4 py-2.5 text-sm font-semibold text-[#52657b]">Keep request</button><button type="submit" className="rounded-lg bg-[#c9343b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ad252c]">Submit cancellation</button></div></form></div>}
  </div>;
}


function Info({ label, value, icon }) { return <div className="flex items-start gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e8eef5] text-[#315b82]"><Icon name={icon} size={15}/></span><span><small className="block text-xs text-[#718197]">{label}</small><b className="mt-0.5 block text-sm leading-5">{value}</b></span></div>; }
