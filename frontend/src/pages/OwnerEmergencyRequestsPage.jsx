import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import RequestStatusBadge, { EmergencyBadge } from "../components/RequestStatusBadge.jsx";
import RequestStatusActions from "../components/RequestStatusActions.jsx";
import useOwnerRequests from "../context/useOwnerRequests.js";
import { emergencyStatuses, isEmergencyRequest, requestStatus } from "../data/ownerRequests.js";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold";

export default function OwnerEmergencyRequestsPage() {
  const { requests, error, loading, changeStatus: saveStatus } = useOwnerRequests();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState(null);
  const emergencies = requests.filter(isEmergencyRequest);
  const selected = emergencyStatuses.includes(params.get("status")) ? params.get("status") : "All";
  const visible = emergencies.filter((request) => (selected === "All" || requestStatus(request.status) === selected)
    && [request.id, request.customerName, request.customerPhone, request.category, request.appliance, request.issue, request.location].some((value) => String(value || "").toLowerCase().includes(search.trim().toLowerCase())))
    .sort((a, b) => (requestStatus(a.status) === "Incoming" ? 0 : 1) - (requestStatus(b.status) === "Incoming" ? 0 : 1)
      || (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));

  async function changeStatus(id, status, reason) {
    try {
      await saveStatus(id, status, reason);
      setFeedback({ message: `${id}: ${status}. The customer can see the updated status.`, error: false });
      return true;
    } catch (err) {
      setFeedback({ message: err.message.includes("request") || err.message.includes("reason") ? err.message : "The update could not be saved. Please try again.", error: true });
      return false;
    }
  }

  return <main className="mx-auto max-w-[1200px] px-[18px] py-8 md:py-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold tracking-widest text-red-700">PRIORITY REPAIR DESK</p><h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Emergency repair requests</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Review urgent customer problems, respond to new requests, and keep customers updated throughout their repair.</p></div>
      <Link to="/owner/requests" className={`${buttonClass} border-2 border-[#d6dfea] bg-white text-[#315b82]`}>All booking requests</Link>
    </div>
    <section aria-label="Emergency request summary" className="my-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[{ label: "Needs response", status: "Incoming", icon: "alert", color: "bg-red-50 text-red-700", detail: "Accept or reject incoming requests" }, { label: "Accepted", status: "Accepted", icon: "check", color: "bg-blue-50 text-blue-700", detail: "Ready for your technician" }, { label: "In progress", status: "In progress", icon: "wrench", color: "bg-violet-50 text-violet-700", detail: "Repairs currently underway" }, { label: "Completed", status: "Completed", icon: "shield", color: "bg-emerald-50 text-emerald-700", detail: "Emergency repairs resolved" }].map((item) => <button type="button" key={item.status} onClick={() => setParams({ status: item.status })} className="rounded-xl border-2 border-[#d6dfea] bg-white p-5 text-left transition hover:border-[#315b82]"><span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-600">{item.label}</span><span className={`grid size-9 place-items-center rounded-lg ${item.color}`}><Icon name={item.icon} size={19} /></span></span><span className="mt-3 block text-3xl font-bold">{error ? "N/A" : emergencies.filter((request) => requestStatus(request.status) === item.status).length}</span><span className="mt-2 block text-xs text-slate-500">{item.detail}</span></button>)}
    </section>
    <div className="mb-6 flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-900"><Icon name="bolt" size={20} /><p className="leading-6"><strong>Urgent requests need your attention.</strong> Incoming requests appear first, oldest first. Customers can track each status update in their repair requests.</p></div>
    {loading && <p role="status" className="mb-5 text-sm text-slate-500">Loading requests...</p>}
    {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {feedback && <p role={feedback.error ? "alert" : "status"} className={`mb-5 rounded-lg border-2 p-4 text-sm ${feedback.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.message}</p>}
    <section aria-label="Emergency requests" className="overflow-hidden rounded-2xl border-2 border-[#d6dfea] bg-white">
      <div className="border-b-2 border-slate-100 p-5 md:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-bold">Emergency queue <span className="ml-1 text-sm font-normal text-slate-500">({visible.length})</span></h2><label className="flex w-full items-center gap-2 rounded-lg border-2 border-[#d6dfea] px-3 sm:w-80"><Icon name="search" size={17} /><input aria-label="Search emergency requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, appliance, location…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm" /></label></div><div aria-label="Filter emergencies by status" className="mt-5 flex flex-wrap gap-2">{["All", ...emergencyStatuses].map((status) => <button type="button" key={status} aria-pressed={selected === status} onClick={() => setParams(status === "All" ? {} : { status })} className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${selected === status ? "border-[#123b66] bg-[#123b66] text-white" : "border-[#d6dfea] text-slate-600 hover:bg-pale"}`}>{status}</button>)}</div></div>
      {!error && !loading && (visible.length ? <div className="divide-y divide-slate-100">{visible.map((request) => <EmergencyRequest key={`${request.id}-${request.status}`} request={request} onChangeStatus={changeStatus} />)}</div> : <div role="status" className="px-6 py-14 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-red-50 text-red-700"><Icon name="shield" size={25} /></span><h3 className="mt-4 text-lg font-bold">{emergencies.length ? "No matching emergency requests" : "No emergency requests yet"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{emergencies.length ? "Try another status or search term." : "Urgent bookings sent to your shop will appear here. You can submit an emergency request from the customer form to try the workflow."}</p><Link to="/request-repair?priority=emergency" className="mt-5 inline-flex text-sm font-semibold text-[#315b82] underline underline-offset-4">Open customer request form</Link></div>)}
    </section>
    <p className="mt-5 text-xs leading-5 text-slate-500">Status changes are saved to your account. Customers can track the latest status in their repair requests.</p>
  </main>;
}

function EmergencyRequest({ request, onChangeStatus }) {
  const status = requestStatus(request.status);
  const created = new Date(request.createdAt);
  return <article className={`border-l-4 p-5 md:p-6 ${status === "Incoming" ? "border-l-red-500" : "border-l-transparent"}`}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><EmergencyBadge /><span className="text-xs font-semibold text-slate-500">{request.id}</span></div><h3 className="mt-3 text-lg font-bold">{request.category || request.appliance || "Appliance not specified"}</h3><p className="mt-1 text-xs text-slate-500">Received {Number.isNaN(created.getTime()) ? "at an unknown time" : created.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p></div><RequestStatusBadge status={status} /></div>
    <p className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">{request.issue || "No problem description provided."}</p>
    <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-3"><Detail label="Customer" value={request.customerName || "Name not provided"} icon="user" /><Detail label="Contact number" value={request.customerPhone || "Phone not provided"} icon="phone" phone={request.customerPhone} /><Detail label="Service location" value={request.location || "Location not provided"} icon="pin" /></dl>
    {request.rejectionReason && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800"><strong>Rejection reason:</strong> {request.rejectionReason}</p>}
    {Array.isArray(request.statusHistory) && request.statusHistory.length > 0 && <details className="mt-5 text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Status history</summary><ol className="mt-3 grid gap-2">{request.statusHistory.map((entry, index) => <li key={index}>{entry.status} · {new Date(entry.createdAt).toLocaleString()}</li>)}</ol></details>}
    <RequestStatusActions request={request} onChangeStatus={onChangeStatus} />
  </article>;
}

function Detail({ label, value, icon, phone }) {
  return <div className="flex min-w-0 gap-2.5"><span className="mt-0.5 text-[#315b82]"><Icon name={icon} size={17} /></span><div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{phone ? <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="underline underline-offset-4">{value}</a> : value}</dd></div></div>;
}
