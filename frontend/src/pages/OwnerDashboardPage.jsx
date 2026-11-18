import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import OwnerRequestList from "../components/OwnerRequestList.jsx";
import { useShops } from "../context/ShopContext.jsx";
import useOwnerRequests from "../context/useOwnerRequests.js";
import { summarizeRequests } from "../data/ownerRequests.js";

const stats = [
  { status: "Incoming", icon: "message", color: "bg-amber-50 text-amber-700", description: "Waiting for your response" },
  { status: "Accepted", icon: "calendar", color: "bg-blue-50 text-blue-700", description: "Ready for an appointment" },
  { status: "In progress", icon: "wrench", color: "bg-violet-50 text-violet-700", description: "Repairs currently underway" },
  { status: "Completed", icon: "check", color: "bg-emerald-50 text-emerald-700", description: "Successfully finished repairs" },
];
export default function OwnerDashboardPage() {
  const { ownerShop: shop } = useShops();
  const { requests, error } = useOwnerRequests();
  const summary = summarizeRequests(requests);
  return <main className="mx-auto max-w-[1200px] px-[18px] py-8 md:py-10">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-widest text-[#315b82]">SHOP OVERVIEW</p><h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Repair shop dashboard</h1><p className="mt-3 text-sm text-slate-500">Welcome back. Here's what's happening at your shop.</p></div><Link to="/owner/requests?status=Incoming" className="inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-3 text-sm font-semibold text-white hover:bg-[#0c2e53]">Incoming bookings<Icon name="arrow" size={16} /></Link></div>
    <section aria-labelledby="shop-overview" className="mb-7 flex flex-wrap items-center gap-5 rounded-2xl border border-[#d6dfea] bg-white p-5 md:p-6">
      <img src={shop.image} alt="" className="size-20 rounded-xl object-cover" />
      <div className="min-w-0 flex-1"><h2 id="shop-overview" className="text-xl font-bold">{shop.name}</h2><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><Icon name="pin" size={15} />{shop.location}</span><span className="inline-flex items-center gap-1.5"><Icon name="phone" size={15} />{shop.phone}</span></div><p className="mt-2 text-sm leading-6 text-slate-500">{shop.description}</p></div>
      <Link to="/owner/profile" className="rounded-lg border border-[#d6dfea] px-4 py-2.5 text-sm font-semibold text-blue hover:bg-pale">View shop profile</Link>
    </section>
    {error && <p role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section aria-label="Repair request summary" className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(({ status, icon, color, description }) => <Link key={status} to={`/owner/requests?status=${encodeURIComponent(status)}`} className="rounded-xl border border-[#d6dfea] bg-white p-5 transition hover:border-[#315b82] hover:shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">{status}</span><span className={`grid size-9 place-items-center rounded-lg ${color}`}><Icon name={icon} size={19} /></span></div><p className="mt-3 text-3xl font-bold">{error ? "—" : summary[status]}</p><p className="mt-2 text-xs text-slate-500">{description}</p></Link>)}</section>
    {!error && summary.Incoming === 0 && <div role="status" className="mb-7 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Icon name="check" size={20} /><div><p className="font-semibold">No incoming requests</p><p className="mt-1 leading-6">You're all caught up. New bookings will appear here when customers request your services.</p></div></div>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section aria-labelledby="recent-requests" className="min-w-0 overflow-hidden rounded-2xl border border-[#d6dfea] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 md:p-6"><div><h2 id="recent-requests" className="text-lg font-bold">Recent repair requests</h2><p className="mt-1 text-xs text-slate-500">Your five most recently received bookings</p></div><Link to="/owner/requests" className="text-sm font-semibold text-blue hover:underline">View all requests →</Link></div>{!error && <OwnerRequestList requests={requests.slice(0, 5)} />}</section>
      <aside className="grid gap-5"><section className="rounded-2xl border border-[#d6dfea] bg-white p-5"><h2 className="font-bold">Manage your shop</h2><QuickLink to="/owner/requests?status=Incoming" icon="calendar" title="Incoming bookings" detail="Review new customer requests" /><QuickLink to="/owner/profile" icon="store" title="Shop profile" detail="View your shop information" /><QuickLink to="/owner/services" icon="wrench" title="Service categories" detail="Manage what your shop repairs" /></section><section className="rounded-2xl border border-[#d6dfea] bg-white p-5"><h2 className="font-bold">Supported services</h2><div className="mt-4 flex flex-wrap gap-2">{shop.services.length ? shop.services.map((service) => <span key={service} className="rounded-full bg-pale px-3 py-1.5 text-xs font-semibold text-[#315b82]">{service}</span>) : <p className="text-sm leading-6 text-slate-500">No categories selected. Add services so customers can book your shop.</p>}</div><Link to="/owner/services" className="mt-4 inline-block text-sm font-semibold text-blue hover:underline">Manage categories →</Link></section></aside>
    </div>
  </main>;
}
function QuickLink({ to, icon, title, detail }) {
  return <Link to={to} className="mt-4 flex items-start gap-3 rounded-lg p-2 hover:bg-pale"><span className="mt-1 text-[#315b82]"><Icon name={icon} size={19} /></span><span><b className="block text-sm">{title}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span></span></Link>;
}
