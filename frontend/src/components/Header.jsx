import { useState } from "react";
import { useLocation } from "react-router-dom";
import Icon from "./Icon.jsx";
import Logo from "./Logo.jsx";
import ProfileMenu from "./ProfileMenu.jsx";
import useCustomer from "../context/useCustomer.js";

const links = [
  { label: "Home", href: "/" },
  { label: "Find Repair Shops", href: "/repair-shops" },
  { label: "Repair Request", href: "/request-repair" },
  { label: "About Us", href: "/#about" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, hash } = useLocation();
  const customer = useCustomer();

  return (
    <header className="relative z-10 h-20 border-b-2 border-[#d6dfea] bg-white">
      <div className="mx-auto flex h-full w-[calc(100%-36px)] max-w-[1200px] items-center justify-between">
        <Logo />
        <nav
          id="main-navigation"
          aria-label="Main navigation"
          className={`${menuOpen ? "flex" : "hidden"} absolute inset-x-[18px] top-full flex-col gap-0 rounded-xl border-2 border-slate-200 bg-white p-2 shadow-xl lg:static lg:flex lg:h-full lg:flex-row lg:items-center lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          {links.map((link) => {
            const active = link.href === "/"
              ? pathname === "/" && !hash
              : link.href === "/#about"
                ? pathname === "/" && hash === "#about"
                : link.href === "/repair-shops"
                  ? pathname.startsWith("/repair-shops")
                  : pathname === link.href;
            return (
              <a
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[42px] items-center px-3 text-[15px] font-medium transition hover:text-navy md:relative md:h-auto md:min-h-[42px] md:px-0 md:py-2 ${active ? "text-navy after:absolute after:inset-x-0 after:bottom-1 after:h-0.5 after:bg-[#285982] after:content-['']" : "text-slate-600"}`}
                href={link.href}
                key={link.label}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <a className="hidden min-h-9 items-center gap-1.5 rounded-lg bg-[#c9343b] px-3.5 text-sm font-semibold text-white transition hover:bg-[#ad252c] sm:inline-flex" href="/emergency-service">
            <span className="grid size-3.5 place-items-center rounded-full border-2 border-current text-[10px]">!</span>
            Emergency Service
          </a>
          <button
            className="grid size-9 place-items-center rounded-lg border-2 border-slate-200 text-navy hover:bg-slate-50 lg:hidden"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen((current) => !current)}
          >
            <Icon name="menu" size={18} />
          </button>
          {customer
            ? <ProfileMenu customer={customer} />
            : <a className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-blue px-3.5 text-sm font-semibold text-white transition hover:bg-[#0c2e53]" href="/login">Log in</a>}
        </div>
      </div>
    </header>
  );
}
