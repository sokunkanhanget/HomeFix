import Icon from "./Icon.jsx";
import heroImage from "../assets/hero-img.png";
export default function HeroSection({
  query,
  location,
  onQueryChange,
  onLocationChange,
  onSearch,
}) {
  return (
    <section className="bg-pale">
      <div className="mx-auto grid min-h-[620px] w-[calc(100%-36px)] max-w-[1200px] grid-cols-1 items-center gap-8 py-12 lg:min-h-[736px] lg:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)] lg:gap-16 lg:py-[80px]">
        <div className="max-w-[565px]">
          <h1 className="m-0 text-[clamp(42px,5vw,58px)] font-extrabold leading-[1.08] tracking-[-2.6px] text-[#102a49] max-sm:text-[clamp(42px,11vw,54px)] max-sm:tracking-[-2px]">
            Home repairs,<br />booked in minutes.
          </h1>
          <p className="mb-[22px] mt-4 max-w-[490px] text-[17px] leading-[1.65] text-[#6a7b91]">
            Find trusted shops for your AC, fridge, TV and more. Book a time that suits you or get emergency help fast.
          </p>
          <form id="search" className="flex h-[51px] items-center gap-2 rounded-[9px] border-2 border-[#e4e9f0] bg-white p-[5px] shadow-[0_5px_16px_rgb(25_48_78_/_5%)] max-[390px]:h-auto max-[390px]:flex-wrap max-[390px]:p-[7px]" onSubmit={onSearch}>
            <label className="flex min-w-0 flex-[1.2] items-center gap-2 px-2 text-[#56708d] max-[390px]:min-h-[35px] max-[390px]:basis-full">
              <Icon name="search" size={16} />
              <input aria-label="What needs fixing?" className="w-full min-w-0 bg-transparent py-1 text-[15px] text-[#263d58] outline-none placeholder:text-[#8290a1]" placeholder="What needs fixing?" value={query} onChange={(event) => onQueryChange(event.target.value)} />
            </label>
            <label className="flex min-w-0 flex-[0.9] items-center gap-2 border-l-2 border-[#e7ebf1] px-2 text-[#56708d] max-[390px]:min-h-[35px] max-[390px]:flex-1 max-[390px]:border-0">
              <Icon name="pin" size={16} />
              <input aria-label="Your location" className="w-full min-w-0 bg-transparent py-1 text-[15px] text-[#263d58] outline-none placeholder:text-[#8290a1]" value={location} onChange={(event) => onLocationChange(event.target.value)} />
            </label>
            <button className="inline-flex h-full min-w-[102px] items-center justify-center gap-1.5 rounded-md bg-blue px-3 text-sm font-semibold text-white transition hover:bg-[#0c2e53] max-[390px]:min-h-[35px]" type="submit">
              <Icon name="search" size={14} /> Search
            </button>
          </form>
          <div className="mt-4 flex flex-wrap justify-between gap-2 text-[13px] text-[#8591a0] max-sm:flex-col">
            <span><b className="mr-1 text-base text-[#d34b52]">△</b> Something urgent? AC died in the heat, fridge leaking, no power?</span>
            <a className="font-semibold text-[#d24d53] hover:underline" href="/request-repair?priority=emergency">☎ Get emergency help</a>
          </div>
        </div>
        <img
          className="aspect-[1.03] w-full max-w-[520px] justify-self-end rounded-[26px] object-cover shadow-[0_12px_26px_rgb(15_41_70_/_11%)] max-sm:justify-self-center"
          src={heroImage}
          alt="Repair technician servicing a washing machine"
        />
      </div>
    </section>
  );
}
