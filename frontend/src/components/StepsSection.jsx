import { steps } from "../data/homepage.js";
import Icon from "./Icon.jsx";
import SectionHeading from "./SectionHeading.jsx";

export default function StepsSection() {
  return (
    <section className="bg-white py-[76px] pb-[70px] max-sm:py-[52px]" id="about">
      <div className="mx-auto w-[calc(100%-36px)] max-w-[1072px]">
        <SectionHeading
          centered
          eyebrow="HOW HOMEFIX WORKS"
          title="Fixed in four simple steps"
          description="From broken to working again — without hunting through random phone numbers."
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-[17px]">
          {steps.map((step, index) => (
            <article className="relative min-h-[166px] overflow-hidden rounded-[15px] border border-[#edf0f5] bg-[#f2f5fa] p-[17px_14px] md:min-h-[169px] md:p-[21px_20px]" key={step.title}>
              <span className="absolute right-[15px] top-[14px] text-[26px] font-extrabold text-[#e0e7f0]">0{index + 1}</span>
              <span className="mb-[15px] grid size-[42px] place-items-center rounded-[11px] bg-[#153d66] text-white">
                <Icon name={step.icon} size={19} />
              </span>
              <h3 className="relative mb-[7px] text-sm font-bold text-[#243b55] md:text-[15px]">{step.title}</h3>
              <p className="relative m-0 text-[13px] leading-[1.6] text-[#7a8899]">{step.description}</p>
            </article>
          ))}
        </div>
        <section className="mt-[45px] flex min-h-0 flex-col items-start justify-between gap-[22px] rounded-2xl bg-[#0e2746] px-6 py-[27px] text-white md:mt-[68px] md:min-h-[202px] md:flex-row md:items-center md:gap-7 md:rounded-[20px] md:px-12 md:py-[35px]">
          <div className="max-w-[670px]">
            <span className="text-xs font-bold tracking-[0.6px] text-[#b5c5d8]">FOR REPAIR SHOPS</span>
            <h2 className="mb-2 mt-2.5 text-[22px] font-bold tracking-[-0.8px] md:text-[26px]">Own a repair shop? Get found online.</h2>
            <p className="m-0 max-w-[610px] text-sm leading-[1.65] text-[#b1bfd0]">
              List your shop for free and receive repair requests from customers nearby. You only pay an 8% commission on completed jobs.
            </p>
          </div>
          <a className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-3.5 text-sm font-semibold text-[#234365] transition hover:bg-[#eaf1f8]" href="mailto:hello@homefix.com?subject=Register%20your%20shop">
            <Icon name="store" size={15} /> Register Your Shop
          </a>
        </section>
      </div>
    </section>
  );
}
