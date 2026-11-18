import { useState } from "react";
import { useLocation } from "react-router-dom";
import Icon from "./Icon.jsx";
import Logo from "./Logo.jsx";
import { useLocation } from "react-router-dom";

const links = [
  { label: "Home", href: "/" },
  { label: "Find Repair Shops", href: "/repair-shops" },
  { label: "Repair Request", href: "/request-repair" },
  { label: "About Us", href: "/#about" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <header className="relative z-10 h-20 border-b border-[#d6dfea] bg-white">
      <div className="mx-auto flex h-full w-[calc(100%-36px)] max-w-[1200px] items-center justify-between">
        <Logo />
        <nav
          id="main-navigation"
          aria-label="Main navigation"
          className={`${menuOpen ? "flex" : "hidden"} absolute inset-x-[18px] top-full flex-col gap-0 rounded-xl border border-slate-200 bg-white p-2 shadow-xl lg:static lg:flex lg:h-full lg:flex-row lg:items-center lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          {links.map((link, index) => {
            const active = link.href === pathname || (link.href === "/repair-shops" && pathname.startsWith("/repair-shops"));
            return (
              <a
                className={`flex min-h-[42px] items-center px-3 text-[15px] font-medium transition hover:text-navy md:relative md:h-full md:min-h-0 md:px-0 ${active || index === 0 ? "text-navy md:after:absolute md:after:inset-x-0 md:after:bottom-0 md:after:h-0.5 md:after:bg-[#285982] md:after:content-['']" : "text-slate-600"}`}
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
          <a className="hidden min-h-9 items-center gap-1.5 rounded-lg bg-[#c9343b] px-3.5 text-sm font-semibold text-white transition hover:bg-[#ad252c] sm:inline-flex" href="tel:119">
            <span className="grid size-3.5 place-items-center rounded-full border border-current text-[10px]">!</span>
            Emergency Service
          </a>
          <button
            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-navy hover:bg-slate-50 lg:hidden"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen((current) => !current)}
          >
            <Icon name="menu" size={18} />
          </button>
          <a className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue px-3.5 text-sm font-semibold text-white transition hover:bg-[#0c2e53]" href="/login">
            Log in
          </a>
        </div>
      </div>
    </header>
  );
}
