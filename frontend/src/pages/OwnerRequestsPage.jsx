import { useSearchParams } from "react-router-dom";
import OwnerRequestList from "../components/OwnerRequestList.jsx";
import useOwnerRequests from "../context/useOwnerRequests.js";
import { requestStatus, requestStatuses } from "../data/ownerRequests.js";

export default function OwnerRequestsPage() {
  const { requests, error } = useOwnerRequests();
  const [params, setParams] = useSearchParams();
  const selected = requestStatuses.includes(params.get("status")) ? params.get("status") : "All";
  const visible = selected === "All" ? requests : requests.filter((request) => requestStatus(request.status) === selected);
  return <main className="mx-auto max-w-[1200px] px-[18px] py-10">
    <h1 className="text-3xl font-bold">Booking requests</h1><p className="mt-3 text-sm text-slate-500">Review customer bookings and repair activity for your shop.</p>
    <div aria-label="Filter requests by status" className="my-6 flex flex-wrap gap-2">{["All", ...requestStatuses].map((status) => <button key={status} type="button" aria-pressed={selected === status} onClick={() => setParams(status === "All" ? {} : { status })} className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${selected === status ? "border-blue bg-blue text-white" : "border-[#d6dfea] bg-white text-slate-600 hover:bg-pale"}`}>{status}</button>)}</div>
    <section aria-label={`${selected} booking requests`} className="overflow-hidden rounded-2xl border-2 border-[#d6dfea] bg-white">
      {error ? <p role="alert" className="p-6 text-sm text-red-700">{error}</p> : visible.length || selected === "Incoming" || selected === "All" ? <OwnerRequestList requests={visible} incomingOnly={selected === "Incoming"} /> : <p role="status" className="p-12 text-center text-sm text-slate-500">No {selected.toLowerCase()} requests. Choose another status to view your bookings.</p>}
    </section>
  </main>;
}
