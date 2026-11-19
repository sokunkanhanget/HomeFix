import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import SectionHeading from "./SectionHeading.jsx";
import RequestStatusBadge, { EmergencyBadge } from "./RequestStatusBadge.jsx";
import useCustomer from "../context/useCustomer.js";
import useRepairRequests from "../context/useRepairRequests.js";
import { isEmergencyRequest, requestStatus } from "../data/ownerRequests.js";
import { formatSubmittedDate, recentRequests, summarizeCustomerRequests } from "../data/customerAccount.js";

const stats = [
  { key: "total", label: "Total requests", icon: "message", color: "bg-slate-100 text-slate-700", description: "All repair requests you've submitted" },
  { key: "pending", label: "Pending", icon: "clock", color: "bg-amber-50 text-amber-700", description: "Waiting for the shop to respond" },
  { key: "accepted", label: "Accepted", icon: "calendar", color: "bg-blue-50 text-blue-700", description: "Confirmed or currently in progress" },
  { key: "completed", label: "Completed", icon: "check", color: "bg-emerald-50 text-emerald-700", description: "Repairs successfully finished" },
];

export default function CustomerDashboard() {
  const customer = useCustomer();
  const { requests, error } = useRepairRequests();
  const summary = summarizeCustomerRequests(requests, requestStatus);
  const recent = recentRequests(requests);
  const firstName = customer?.name?.trim().split(/\s+/)[0];

  return (
    <section id="dashboard" aria-labelledby="dashboard-title" className="scroll-mt-4 bg-white pt-[74px] text-navy max-sm:pt-[52px]">
      <div className="mx-auto w-[calc(100%-36px)] max-w-[1200px]">
        <SectionHeading
          eyebrow="MY DASHBOARD"
          title={<span id="dashboard-title">{firstName ? `Welcome back, ${firstName}` : "Your repair dashboard"}</span>}
          description="Monitor your repair requests and manage your account."
          action={<Link to="/request-repair" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-[#163f6b] px-4 text-sm font-semibold text-white hover:bg-[#0c2e53]"><Icon name="wrench" size={15} />Request a Repair</Link>}
        />

        <div className="mb-5 flex flex-wrap items-center gap-5 rounded-2xl border-2 border-[#d6dfea] bg-[#f7f9fc] p-5 md:p-6">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#e6eef7] text-lg font-bold text-[#315b82]">{customer ? initials(customer.name) : <Icon name="user" size={24} />}</span>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-lg font-bold">{customer ? customer.name : "You're not logged in"}</h3>
            {customer ? <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5 break-all"><Icon name="mail" size={15} />{customer.email || "Email not provided"}</span><span className="inline-flex items-center gap-1.5"><Icon name="phone" size={15} />{customer.phone || "Phone not provided"}</span><span className="inline-flex items-center gap-1.5 capitalize"><Icon name="user" size={15} />{customer.role || "customer"} account</span></div>
              : <p className="m-0 mt-1.5 text-sm text-slate-500">Log in to see your account details. Requests saved in this browser are shown below.</p>}
          </div>
          {customer ? <Link to="/profile" className="rounded-lg border-2 border-[#163f6b] bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2e53]">Profile settings</Link>
            : <Link to="/login" className="rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white">Log in</Link>}
        </div>

        {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}

        <div aria-label="Repair request summary" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-[17px]">{stats.map(({ key, label, icon, color, description }) => <div key={key} className="rounded-[13px] border-2 border-[#d6dfea] bg-white p-4 md:p-5"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-600">{label}</span><span className={`grid size-9 place-items-center rounded-lg ${color}`}><Icon name={icon} size={19} /></span></div><p className="m-0 mt-3 text-3xl font-bold">{error ? "—" : summary[key]}</p><p className="mb-0 mt-2 text-xs text-slate-500">{description}</p></div>)}</div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 overflow-hidden rounded-2xl border-2 border-[#d6dfea] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#d6dfea] p-5"><div><h3 className="m-0 text-base font-bold">Recently submitted requests</h3><p className="mb-0 mt-1 text-xs text-slate-500">Your five most recent repair requests</p></div><Link to="/my-repair-requests" className="text-sm font-semibold text-[#163f6b] hover:underline">View all requests →</Link></div>
            {!error && (recent.length ? <ul className="m-0 list-none divide-y divide-slate-100 p-0">{recent.map((request) => <li key={request.id} className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="m-0 text-xs font-semibold tracking-wide text-[#718197]">{request.id}</p>
                <h4 className="m-0 mt-1 text-[15px] font-bold">{request.category || request.appliance || "Repair request"}</h4>
                <dl className="m-0 mt-2 grid gap-x-5 gap-y-1 text-sm text-slate-500 sm:flex sm:flex-wrap">
                  <div className="flex items-center gap-1.5"><dt className="sr-only">Repair shop</dt><Icon name="store" size={14} /><dd className="m-0">{request.shop || "Shop not selected"}</dd></div>
                  <div className="flex items-center gap-1.5"><dt className="sr-only">Submitted</dt><Icon name="calendar" size={14} /><dd className="m-0">Submitted {formatSubmittedDate(request.createdAt)}</dd></div>
                </dl>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">{isEmergencyRequest(request) && <EmergencyBadge />}<RequestStatusBadge status={request.status} /></div>
            </li>)}</ul>
              : <div className="px-5 py-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e6eef7] text-[#315b82]"><Icon name="calendar" size={22} /></span><h4 className="mb-2 mt-4 text-base font-bold">No repair requests yet</h4><p className="m-0 text-sm text-[#718197]">When you submit a repair request, it will appear here so you can track its status.</p><Link to="/request-repair" className="mt-4 inline-flex rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white">Request a Repair</Link></div>)}
          </div>

          <nav aria-label="Dashboard quick links" className="rounded-2xl border-2 border-[#d6dfea] bg-white p-5"><h3 className="m-0 text-base font-bold">Quick links</h3>
            <QuickLink to="/my-repair-requests" icon="message" title="My repair requests" detail="Track and manage all your requests" />
            <QuickLink to="/profile" icon="user" title="Profile settings" detail="View and update your account details" />
            <QuickLink to="/repair-shops" icon="store" title="Find repair shops" detail="Browse trusted shops near you" />
            <QuickLink to="/emergency-service" icon="alert" title="Emergency service" detail="Get urgent help for a breakdown" />
          </nav>
        </div>
      </div>
    </section>
  );
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

function QuickLink({ to, icon, title, detail }) {
  return <Link to={to} className="mt-3 flex items-start gap-3 rounded-lg p-2 hover:bg-[#f0f4f9]"><span className="mt-1 text-[#315b82]"><Icon name={icon} size={19} /></span><span><b className="block text-sm">{title}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span></span></Link>;
}
