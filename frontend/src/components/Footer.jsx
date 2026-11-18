import Logo from "./Logo.jsx";

const linkGroups = [
  {
    title: "Explore",
    links: [
      ["Find Repair Shops", "/#shops"],
      ["Emergency Services", "tel:119"],
      ["Request Repair", "/request-repair"],
      ["About Us", "/#about"],
    ],
  },
  {
    title: "For Repair Shops",
    links: [
      ["Register Your Shop", "mailto:hello@homefix.com?subject=Register%20your%20shop"],
      ["Partner Benefits", "mailto:hello@homefix.com"],
      ["Shop Login", "mailto:hello@homefix.com"],
    ],
  },
  {
    title: "Contact",
    links: [
      ["+855 23 900 000", "tel:+85523000000"],
      ["hello@homefix.com", "mailto:hello@homefix.com"],
    ],
    note: "Phnom Penh, Cambodia",
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#0d2340] py-[49px] pb-5 text-[#f5f8fc]" id="footer">
      <div className="mx-auto w-[calc(100%-36px)] max-w-[1200px]">
        <div className="grid grid-cols-2 gap-x-[22px] gap-y-8 pb-[38px] md:grid-cols-[1.45fr_0.9fr_1fr_1fr] md:gap-[52px]">
          <div className="col-span-2 md:col-span-1">
            <Logo light />
            <p className="mt-[15px] max-w-[260px] text-[13px] leading-[1.75] text-[#aebccd]">
              One place to find trusted repair shops, book a service, and get fast help when something breaks at home.
            </p>
          </div>
          {linkGroups.map((group) => (
            <div className="flex flex-col items-start gap-2.5" key={group.title}>
              <h3 className="mb-1 mt-0.5 text-[13px] font-bold text-white">{group.title}</h3>
              {group.links.map(([label, href]) => (
                <a
                  className="text-xs text-[#aebccd] transition hover:text-white"
                  href={href}
                  key={label}
                >{label}</a>
              ))}
              {group.note && <span className="text-xs text-[#aebccd]">{group.note}</span>}
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-4 border-t border-white/10 pt-[18px] text-xs text-[#91a1b5] max-[390px]:text-[11px]">
          <span>© 2024 HomeFix. All rights reserved.</span>
          <span className="flex gap-5"><a className="hover:text-white" href="#footer">Privacy</a><a className="hover:text-white" href="#footer">Terms</a></span>
        </div>
      </div>
    </footer>
  );
}
