import { useState } from "react";
import Icon from "./Icon.jsx";
import { isEmergencyRequest, requestStatus } from "../data/ownerRequests.js";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold";

// Owner actions for moving a request through Incoming → Accepted → In progress → Completed (or Rejected).
export default function RequestStatusActions({ request, onChangeStatus }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const status = requestStatus(request.status);
  return <>
    {status === "Incoming" && !rejecting && <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setRejecting(true)} className={`${buttonClass} border border-red-200 text-red-700 hover:bg-red-50`}>Reject request</button><button type="button" onClick={() => onChangeStatus(request.id, "Accepted")} className={`${buttonClass} bg-[#123b66] text-white hover:bg-[#0c2e53]`}><Icon name="check" size={17} />Accept request</button></div>}
    {status === "Incoming" && rejecting && <form onSubmit={(event) => { event.preventDefault(); if (onChangeStatus(request.id, "Rejected", reason)) setRejecting(false); }} className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4"><label className="block text-sm font-semibold text-red-900">Reason for rejection<textarea autoFocus required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={`Explain why your shop cannot handle this ${isEmergencyRequest(request) ? "emergency" : "request"}.`} className="mt-2 min-h-24 w-full rounded-lg border border-red-200 bg-white p-3 text-sm font-normal text-navy" /></label><p className="mt-2 text-xs text-red-800">This reason will be shared with the customer. {reason.length}/500</p><div className="mt-4 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setRejecting(false)} className={`${buttonClass} border border-[#d6dfea] bg-white text-slate-600`}>Keep request</button><button type="submit" disabled={!reason.trim()} className={`${buttonClass} bg-red-700 text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50`}>Confirm rejection</button></div></form>}
    {["Accepted", "In progress"].includes(status) && <div className="mt-5 flex justify-end"><button type="button" onClick={() => onChangeStatus(request.id, status === "Accepted" ? "In progress" : "Completed")} className={`${buttonClass} bg-[#123b66] text-white hover:bg-[#0c2e53]`}><Icon name={status === "Accepted" ? "wrench" : "check"} size={17} />{status === "Accepted" ? "Start repair" : "Mark as completed"}</button></div>}
  </>;
}

export function StatusHistory({ entries, className = "mt-5 text-xs text-slate-500" }) {
  if (!entries.length) return null;
  return <details className={className}><summary className="cursor-pointer font-semibold">Status history</summary><ol className="mt-3 grid gap-2">{entries.map((entry, index) => <li key={index}>{entry.status} · {new Date(entry.createdAt).toLocaleString()}</li>)}</ol></details>;
}
