import { Link, NavLink, Outlet } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { useShops } from "../context/ShopContext.jsx";

export default function OwnerLayout() {
  const { directory, ownerShop, setOwnerShopId } = useShops();
  const navigation = [["/owner/dashboard", "Dashboard"], ["/owner/requests", "Booking requests"], ["/owner/profile", "Shop profile"], ["/owner/services", "Shop Services"]];
  return (
    <div className="owner-workspace flex min-h-screen flex-col bg-pale text-navy [&_main]:w-full [&_main]:flex-1">
      <header className="border-b border-[#d6dfea] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-[18px] py-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex flex-wrap items-center justify-center gap-4 xl:justify-start">
            <Logo />
            <span className="rounded-full bg-[#e3edf7] px-3 py-1 text-xs font-bold text-[#315b82]">Shop Owner</span>
          </div>
          <nav aria-label="Owner navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4 text-sm font-semibold">
            {navigation.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? "text-[#123b66] underline underline-offset-8" : "text-[#5a6b82] hover:text-navy"}>{label}</NavLink>)}
          </nav>
          <Link to="/" className="text-sm font-semibold text-[#5a6b82] hover:text-navy xl:justify-self-end">View customer site</Link>
        </div>
      </header>
      <div className="border-b border-[#d6dfea] bg-white px-[18px] py-3"><div className="mx-auto flex max-w-[1164px] flex-wrap items-center gap-x-4 gap-y-2"><label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#315b82]">Preview provider account<select value={ownerShop.id} onChange={(event) => setOwnerShopId(event.target.value)} className="max-w-full rounded-lg border border-[#d6dfea] bg-white px-3 py-2 text-sm text-navy">{directory.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label><p className="text-xs text-slate-500">Demo workspace · Bookings are stored in this browser.</p></div></div>
      <Outlet />
      <footer className="border-t border-[#d6dfea] bg-white px-[18px] py-6 text-center text-xs text-[#6a7b91]">HomeFix · Shop owner workspace</footer>
    </div>
  );
}
