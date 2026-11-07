export default function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
  action,
}) {
  return (
    <div className={`mb-[30px] flex gap-5 ${centered ? "mx-auto max-w-[540px] flex-col items-center text-center" : "items-end justify-between max-sm:items-start"}`}>
      <div>
        <span className="mb-2.5 inline-block text-xs font-bold tracking-[1px] text-[#477199]">{eyebrow}</span>
        <h2 className="m-0 text-[27px] font-bold tracking-[-0.9px] text-navy max-sm:text-[23px]">{title}</h2>
        <p className="mt-[9px] text-[15px] leading-relaxed text-[#7d8b9b] max-sm:text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}
