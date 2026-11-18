import { requestStatus } from "../data/ownerRequests.js";

const styles = {
  Incoming: "bg-amber-50 text-amber-800",
  Accepted: "bg-blue-50 text-blue-800",
  "In progress": "bg-violet-50 text-violet-800",
  Completed: "bg-emerald-50 text-emerald-800",
  Rejected: "bg-red-50 text-red-800",
};

export default function RequestStatusBadge({ status }) {
  const label = requestStatus(status);
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${styles[label] || "bg-slate-100 text-slate-600"}`}><span className="size-1.5 rounded-full bg-current" />{label}</span>;
}

export function EmergencyBadge() {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800"><span aria-hidden="true">⚡</span>Emergency</span>;
}
