import { Link, NavLink, Outlet } from "react-router-dom";
import Logo from "../components/Logo.jsx";

export default function OwnerLayout() {
  return (
    <div className="min-h-screen bg-white text-navy">
      <header className="border-b border-[#d6dfea] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-[18px] py-5">
          <div className="flex flex-wrap items-center gap-4">
            <Logo />
            <span className="rounded-full bg-[#e3edf7] px-3 py-1 text-xs font-bold text-[#315b82]">Shop Owner</span>
          </div>
          <nav aria-label="Owner navigation" className="flex flex-wrap items-center gap-6 text-sm font-semibold">
            <NavLink to="/owner/services" className="text-[#123b66] underline underline-offset-8">Shop Services</NavLink>
            <Link to="/" className="text-[#5a6b82] hover:text-navy">View customer site</Link>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-[#d6dfea] px-[18px] py-6 text-center text-xs text-[#6a7b91]">HomeFix · Shop owner workspace</footer>
    </div>
  );
}
