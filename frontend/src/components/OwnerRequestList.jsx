import Icon from "./Icon.jsx";
import { isEmergencyRequest, requestStatus } from "../data/ownerRequests.js";
import { EmergencyBadge } from "./RequestStatusBadge.jsx";
import { Link } from "react-router-dom";
import RequestStatusActions, { StatusHistory } from "./RequestStatusActions.jsx";

const badgeStyles = {
  Incoming: "bg-amber-50 text-amber-800",
  Accepted: "bg-blue-50 text-blue-800",
  "In progress": "bg-violet-50 text-violet-800",
  Completed: "bg-emerald-50 text-emerald-800",
  Rejected: "bg-red-50 text-red-800",
};

export default function OwnerRequestList({ requests, incomingOnly = false, onChangeStatus }) {
  if (!requests.length) return <div className="px-6 py-14 text-center" role="status">
    <span className="mx-auto grid size-12 place-items-center rounded-full bg-pale text-blue"><Icon name="calendar" size={23} /></span>
    <h3 className="mt-4 text-lg font-bold">{incomingOnly ? "No incoming requests" : "No repair requests yet"}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{incomingOnly ? "You're all caught up. New customer bookings will appear here when they arrive." : "When customers book a repair with your shop, their requests will appear here."}</p>
  </div>;
  return <ul className="divide-y divide-slate-100">
    {requests.map((request) => {
      const status = requestStatus(request.status);
      return <li key={request.id} className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-semibold text-slate-500">{request.id}</p><h3 className="mt-1 font-bold">{request.category || request.appliance || "Category not provided"}</h3></div>
          <div className="flex flex-wrap gap-2">{isEmergencyRequest(request) && <EmergencyBadge />}<span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${badgeStyles[status] || "bg-slate-100 text-slate-600"}`}>{status}</span></div>
        </div>
        <p className="mt-2 break-words text-sm leading-6 text-slate-500">{request.issue || "No issue description provided"}</p>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <RequestDetail label="Customer" value={request.customerName || "Name not provided"} icon="user" />
          <RequestDetail label="Phone" value={request.customerPhone || "Phone not provided"} icon="phone" />
          <RequestDetail label="Service address" value={request.location || "Address not provided"} icon="pin" />
          <RequestDetail label="Appointment" value={[request.date, request.time].filter(Boolean).join(" · ") || "To be confirmed"} icon="calendar" />
        </dl>
        {request.rejectionReason && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800"><strong>Rejection reason:</strong> {request.rejectionReason}</p>}
        {onChangeStatus && <StatusHistory entries={Array.isArray(request.statusHistory) ? request.statusHistory : []} />}
        {isEmergencyRequest(request) ? <Link to="/owner/emergency-requests" className="mt-4 inline-flex text-sm font-semibold text-red-700 underline underline-offset-4">Manage emergency request</Link>
          : onChangeStatus && <RequestStatusActions key={status} request={request} onChangeStatus={onChangeStatus} />}
      </li>;
    })}
  </ul>;
}

function RequestDetail({ label, value, icon }) {
  return <div className="flex min-w-0 gap-2"><span className="mt-0.5 text-[#315b82]"><Icon name={icon} size={16} /></span><div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div></div>;
}
