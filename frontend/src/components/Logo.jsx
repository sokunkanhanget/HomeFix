import homeLogo from "../assets/figma/home.svg";
import homeLogoDark from "../assets/figma/home-dark.svg";

export default function Logo({ light = false }) {
  return (
    <a
      className={`inline-flex shrink-0 items-center gap-2.5 text-[22px] font-bold tracking-[-0.11px] ${light ? "text-white" : "text-navy"}`}
      href="/"
      aria-label="HomeFix home"
    >
      <span className={`grid size-[38px] place-items-center rounded-[10px] ${light ? "bg-white text-navy" : "bg-blue text-white"}`}>
        <img src={light ? homeLogoDark : homeLogo} alt="" width="22" height="22" />
      </span>
      <span>HomeFix</span>
    </a>
  );
}
