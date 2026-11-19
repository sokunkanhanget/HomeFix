import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import Icon from "../components/Icon.jsx";
import { useShops } from "../context/ShopContext.jsx";

const filters = ["All", "Pending", "Approved", "Rejected"];
const statusStyles = {
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-red-50 text-red-800",
};

export default function AdminShopRegistrationsPage() {
  const { registrations, reviewShopRegistration } = useShops();
  const [filter, setFilter] = useState("Pending");
  const [error, setError] = useState("");
  const visibleRegistrations = useMemo(() => filter === "All"
    ? registrations
    : registrations.filter((item) => item.status === filter.toLowerCase()), [filter, registrations]);
  const counts = Object.fromEntries(["pending", "approved", "rejected"].map((status) => [status, registrations.filter((item) => item.status === status).length]));

  function review(id, decision) {
    try {
      reviewShopRegistration(id, decision);
      setError("");
    } catch (reviewError) {
      setError(reviewError.message || "Could not update this registration. Refresh and try again.");
    }
  }

  return <div className="min-h-screen bg-[#f0f4f9] text-[#102847]">
    <header className="border-b border-[#d6dfea] bg-white px-[18px] py-4"><div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><Logo/><span className="rounded-full bg-[#e8edf5] px-3 py-1.5 text-xs font-bold text-[#315b82]">Admin</span></div><nav className="flex flex-wrap items-center gap-4 text-sm font-semibold"><Link to="/" className="text-[#53677f] hover:text-[#102847]">Customer site</Link><Link to="/repair-shops" className="text-[#53677f] hover:text-[#102847]">Public directory</Link></nav></div></header>
    <main className="mx-auto max-w-[1200px] px-[18px] py-8 md:py-10">
      <p className="m-0 text-xs font-bold tracking-[.12em] text-[#315b82]">PLATFORM MANAGEMENT</p>
      <h1 className="mb-0 mt-2 text-3xl font-bold">Shop registrations</h1>
      <p className="mb-0 mt-2 text-sm text-slate-600">Review submitted shop details and decide whether each business can appear in the customer directory.</p>
      <section aria-label="Registration totals" className="mt-6 grid gap-3 sm:grid-cols-3">
        {[ ["Pending review", counts.pending, "text-amber-800"], ["Approved and listed", counts.approved, "text-emerald-800"], ["Rejected", counts.rejected, "text-red-800"] ].map(([label, count, color]) => <div key={label} className="rounded-xl border border-[#d6dfea] bg-white p-4"><p className="m-0 text-xs font-semibold text-slate-500">{label}</p><p className={`mb-0 mt-2 text-2xl font-bold ${color}`}>{count}</p></div>)}
      </section>
      <section className="mt-7 overflow-hidden rounded-2xl border border-[#d6dfea] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf3] p-4 md:p-5"><div><h2 className="m-0 text-lg font-bold">Submitted businesses</h2><p className="mb-0 mt-1 text-xs text-slate-500">{registrations.length} registration{registrations.length === 1 ? "" : "s"} total</p></div><div role="group" aria-label="Filter registrations" className="flex flex-wrap gap-2">{filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${filter === item ? "border-[#163f6b] bg-[#163f6b] text-white" : "border-[#d6dfea] text-[#46617d] hover:bg-[#f5f8fb]"}`}>{item}</button>)}</div></div>
        {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {!visibleRegistrations.length ? <div className="px-5 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="store" size={22}/></span><h3 className="mb-0 mt-4 text-lg font-bold">{registrations.length ? `No ${filter.toLowerCase()} registrations` : "No shop registrations yet"}</h3><p className="mx-auto mb-0 mt-2 max-w-lg text-sm leading-6 text-slate-500">{registrations.length ? "Choose another status filter to see the other submissions." : "Shop applications submitted through the registration form will appear here for review."}</p><Link to="/shop-register" className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-[#315b82] px-4 text-sm font-semibold text-[#315b82] hover:bg-[#f5f8fb]">Open shop registration form</Link></div> : <ul className="divide-y divide-[#edf1f5]">{visibleRegistrations.map((registration) => <li key={registration.id} className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-xs font-semibold text-slate-500">Submitted {registration.submittedAt ? new Date(registration.submittedAt).toLocaleString() : "date unavailable"}</p><h3 className="mb-0 mt-1 text-lg font-bold">{registration.name}</h3><p className="mb-0 mt-1 text-sm text-slate-600">{registration.category} · {registration.serviceType}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusStyles[registration.status] || "bg-slate-100 text-slate-700"}`}>{registration.status === "approved" ? "Approved · listed" : registration.status === "rejected" ? "Rejected · not listed" : registration.status}</span></div>
          <p className="mb-0 mt-4 text-sm leading-6 text-slate-600">{registration.description}</p>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><Detail label="Address" value={registration.address || registration.location}/><Detail label="Direct phone" value={registration.phone}/><Detail label="Email" value={registration.email}/><Detail label="Operating hours" value={registration.operatingHours}/></dl>
          {registration.status === "pending" && <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => review(registration.id, "approved")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"><Icon name="check" size={15}/>Approve and list</button><button type="button" onClick={() => review(registration.id, "rejected")} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50"><span aria-hidden="true" className="text-base leading-none">×</span>Reject</button></div>}
          {registration.reviewedAt && <p className="mb-0 mt-4 text-xs text-slate-500">Reviewed {new Date(registration.reviewedAt).toLocaleString()}</p>}
        </li>)}</ul>}
      </section>
    </main>
  </div>;
}

function Detail({ label, value }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mb-0 mt-1 break-words font-semibold">{value || "Not provided"}</dd></div>;
}
