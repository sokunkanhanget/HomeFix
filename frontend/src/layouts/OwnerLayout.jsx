import { Link, NavLink, Outlet } from "react-router-dom";
import Logo from "../components/Logo.jsx";


export default function OwnerLayout() {

  const navigation = [["/owner/dashboard", "Dashboard"], ["/owner/requests", "Booking requests"], ["/owner/emergency-requests", "Emergency requests"], ["/owner/profile", "Shop profile"], ["/owner/services", "Shop Services"]];
  return (
    <div className="owner-workspace flex min-h-screen flex-col bg-pale text-navy [&_main]:w-full [&_main]:flex-1">
      <header className="border-b-2 border-[#d6dfea] bg-white">
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
      <div className="border-b-2 border-[#d6dfea] bg-white px-[18px] py-3 text-center text-xs text-slate-500">Bookings for your assigned shop. Status changes are saved to your account.</div>
      <Outlet />
      <footer className="border-t-2 border-[#d6dfea] bg-white px-[18px] py-6 text-center text-xs text-[#6a7b91]">HomeFix · Shop owner workspace</footer>
    </div>
  );
}
