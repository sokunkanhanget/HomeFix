import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import OwnerRequestList from "../components/OwnerRequestList.jsx";
import useOwnerRequests from "../context/useOwnerRequests.js";
import { requestStatus, requestStatuses } from "../data/ownerRequests.js";

const filters = [...requestStatuses, "Rejected"];

export default function OwnerRequestsPage() {
  const { requests, error, loading, changeStatus: saveStatus } = useOwnerRequests();
  const [params, setParams] = useSearchParams();
  const [feedback, setFeedback] = useState(null);
  const selected = filters.includes(params.get("status")) ? params.get("status") : "All";
  const visible = selected === "All" ? requests : requests.filter((request) => requestStatus(request.status) === selected);

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

  return <main className="mx-auto max-w-[1200px] px-[18px] py-10">
    <h1 className="text-3xl font-bold">Booking requests</h1><p className="mt-3 text-sm text-slate-500">Review customer bookings and repair activity for your shop.</p>
    <div aria-label="Filter requests by status" className="my-6 flex flex-wrap gap-2">{["All", ...filters].map((status) => <button key={status} type="button" aria-pressed={selected === status} onClick={() => setParams(status === "All" ? {} : { status })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selected === status ? "border-blue bg-blue text-white" : "border-[#d6dfea] bg-white text-slate-600 hover:bg-pale"}`}>{status}</button>)}</div>
    {feedback && <p role={feedback.error ? "alert" : "status"} className={`mb-5 rounded-lg border p-4 text-sm ${feedback.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.message}</p>}
    <section aria-label={`${selected} booking requests`} className="overflow-hidden rounded-2xl border border-[#d6dfea] bg-white">
      {loading ? <p role="status" className="p-6 text-sm text-slate-500">Loading requests...</p> : error ? <p role="alert" className="p-6 text-sm text-red-700">{error}</p> : visible.length || selected === "Incoming" || selected === "All" ? <OwnerRequestList requests={visible} incomingOnly={selected === "Incoming"} onChangeStatus={changeStatus} /> : <p role="status" className="p-12 text-center text-sm text-slate-500">No {selected.toLowerCase()} requests. Choose another status to view your bookings.</p>}
    </section>
  </main>;
}
