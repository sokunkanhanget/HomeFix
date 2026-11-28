import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import Icon from "../components/Icon.jsx";
import { activityActions, activityLabel, fetchActivityLogs } from "../data/activityLogApi.js";

const PAGE_SIZE = 25;
const entityTypes = [["", "All records"], ["user", "Users"], ["shop_registration", "Shops"], ["repair_request", "Repair requests"]];

const actionStyles = {
  user: "bg-[#e7eef6] text-[#315b82]",
  shop: "bg-emerald-50 text-emerald-800",
  booking: "bg-amber-50 text-amber-800",
  emergency_request: "bg-red-50 text-red-800",
};

function formatTime(value) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function describeDetails(entry) {
  const d = entry.details || {};
  const parts = [];
  if (d.shopName) parts.push(d.shopName);
  if (d.previousStatus && d.status) parts.push(`${d.previousStatus} → ${d.status}`);
  else if (d.status) parts.push(`Status: ${d.status}`);
  if (d.category) parts.push(d.category);
  if (d.email) parts.push(d.email);
  if (typeof d.supportsEmergency === "boolean" && entry.action === "shop.emergency_service_updated") {
    parts.push(d.supportsEmergency ? "Emergency service on" : "Emergency service off");
  }
  if (d.rejectionReason) parts.push(`Reason: ${d.rejectionReason}`);
  if (d.cancellationReason) parts.push(`Reason: ${d.cancellationReason}`);
  if (d.reason) parts.push(`Reason: ${d.reason}`);
  return parts.join(" · ");
}

// Read-only, paginated view of platform activity for administrators.
export default function AdminActivityLogPage() {
  const [filters, setFilters] = useState({ action: "", entityType: "", entityId: "" });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ key: null, data: [], pagination: null, error: "", status: 0 });
  const key = JSON.stringify({ ...filters, page });
  const loading = result.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    fetchActivityLogs({ ...filters, page, limit: PAGE_SIZE }, controller.signal)
      .then((body) => setResult({ key, data: body.data, pagination: body.pagination, error: "", status: 200 }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        setResult({ key, data: [], pagination: null, error: error.message, status: error.status || 0 });
      });
    return () => controller.abort();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  const { pagination } = result;
  const selectClass = "rounded-lg border-2 border-[#d6dfea] bg-white px-3 py-2 text-sm outline-none focus:border-[#315b82]";

  return <div className="min-h-screen bg-[#f0f4f9] text-[#102847]">
    <header className="border-b border-[#d6dfea] bg-white px-[18px] py-4"><div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><Logo/><span className="rounded-full bg-[#e8edf5] px-3 py-1.5 text-xs font-bold text-[#315b82]">Admin</span></div><nav className="flex flex-wrap items-center gap-4 text-sm font-semibold"><Link to="/admin/shops" className="text-[#53677f] hover:text-[#102847]">Shop registrations</Link><Link to="/admin/activity" aria-current="page" className="text-[#102847]">Activity log</Link><Link to="/" className="text-[#53677f] hover:text-[#102847]">Customer site</Link></nav></div></header>
    <main className="mx-auto max-w-[1200px] px-[18px] py-8 md:py-10">
      <p className="m-0 text-xs font-bold tracking-[.12em] text-[#315b82]">PLATFORM MANAGEMENT</p>
      <h1 className="mb-0 mt-2 text-3xl font-bold">Activity log</h1>
      <p className="mb-0 mt-2 text-sm text-slate-600">A read-only record of registrations, shop reviews, bookings and emergency requests, newest first.</p>

      <section className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-[#d6dfea] bg-white p-4">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Action
          <select value={filters.action} onChange={(event) => updateFilter("action", event.target.value)} className={selectClass}>
            <option value="">All actions</option>
            {activityActions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Record type
          <select value={filters.entityType} onChange={(event) => updateFilter("entityType", event.target.value)} className={selectClass}>
            {entityTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Record ID
          <input value={filters.entityId} onChange={(event) => updateFilter("entityId", event.target.value.trim())} placeholder="e.g. 12 or a request ID" maxLength={100} className={selectClass} />
        </label>
        {(filters.action || filters.entityType || filters.entityId) && <button type="button" onClick={() => { setFilters({ action: "", entityType: "", entityId: "" }); setPage(1); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#315b82] hover:bg-[#f0f4f9]">Clear filters</button>}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[#d6dfea] bg-white">
        {result.error ? <div role="alert" className="px-5 py-12 text-center">
          <h2 className="m-0 text-lg font-bold">{result.status === 401 ? "Please log in" : result.status === 403 ? "Administrator access required" : "Could not load the activity log"}</h2>
          <p className="mb-0 mt-2 text-sm text-slate-600">{result.status === 403 ? "Only administrators can view platform activity." : result.error}</p>
          {result.status === 401 && <Link to="/login" className="mt-4 inline-flex rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white">Log in</Link>}
        </div>
          : loading && !result.data.length ? <p role="status" className="m-0 px-5 py-12 text-center text-sm text-slate-500">Loading activity…</p>
            : !result.data.length ? <div className="px-5 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="clock" size={22}/></span><h2 className="mb-0 mt-4 text-lg font-bold">No activity found</h2><p className="mb-0 mt-2 text-sm text-slate-500">Try different filters.</p></div>
              : <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}><table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-slate-500"><tr>
                  <th className="px-4 py-3 font-semibold">Time</th><th className="px-4 py-3 font-semibold">Action</th><th className="px-4 py-3 font-semibold">Actor</th><th className="px-4 py-3 font-semibold">Record</th><th className="px-4 py-3 font-semibold">Details</th>
                </tr></thead>
                <tbody className="divide-y divide-[#eef2f7]">{result.data.map((entry) => <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600"><time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time></td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${actionStyles[entry.action.split(".")[0]] || "bg-slate-100 text-slate-700"}`}>{activityLabel(entry.action)}</span></td>
                  <td className="px-4 py-3">{entry.actor ? <><b className="block">{entry.actor.name || `User ${entry.actor.id}`}</b><small className="capitalize text-slate-500">{entry.actor.role || "unknown role"}{entry.actor.id ? ` · #${entry.actor.id}` : ""}</small></> : <span className="text-slate-400">System</span>}</td>
                  <td className="px-4 py-3"><button type="button" onClick={() => { setFilters({ action: "", entityType: entry.entity.type, entityId: entry.entity.id || "" }); setPage(1); }} className="text-left text-[#315b82] hover:underline" title="Show all activity for this record"><span className="block text-xs text-slate-500">{entry.entity.type.replace("_", " ")}</span><span className="break-all font-mono text-xs">{entry.entity.id}</span></button></td>
                  <td className="px-4 py-3 text-slate-600">{describeDetails(entry) || "—"}</td>
                </tr>)}</tbody>
              </table></div>}

        {pagination && pagination.total > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf3] px-4 py-3 text-sm">
          <span className="text-slate-500">Page {pagination.page} of {Math.max(pagination.totalPages, 1)} · {pagination.total} record{pagination.total === 1 ? "" : "s"}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border-2 border-[#d6dfea] px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border-2 border-[#d6dfea] px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
          </div>
        </div>}
      </section>
    </main>
  </div>;
}
