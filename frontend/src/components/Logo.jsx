import Icon from "./Icon.jsx";

export default function Logo({ light = false }) {
  return (
    <a
      className={`inline-flex shrink-0 items-center gap-2 text-[17px] font-bold tracking-[-0.5px] ${light ? "text-white" : "text-navy"}`}
      href="#top"
      aria-label="HomeFix home"
    >
      <span className={`grid size-[30px] place-items-center rounded-lg ${light ? "bg-white text-navy" : "bg-blue text-white"}`}>
        <Icon name="home" size={18} />
      </span>
      <span>HomeFix</span>
    </a>
  );
}
