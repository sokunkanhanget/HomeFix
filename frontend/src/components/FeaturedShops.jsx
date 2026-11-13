import Icon from "./Icon.jsx";
import SectionHeading from "./SectionHeading.jsx";
import ShopCard from "./ShopCard.jsx";

export default function FeaturedShops({
  shops,
  query,
  location,
  searched,
  onShopSelect,
  onReset,
}) {
  return (
    <section className="bg-pale py-[69px] pb-[76px] max-sm:py-[52px]" id="shops">
      <div className="mx-auto w-[calc(100%-36px)] max-w-[1200px]">
        <SectionHeading
          eyebrow="FEATURED"
          title="Top-rated repair shops"
          description="Verified by our team and loved by customers across Phnom Penh."
          action={
            <a className="mt-[19px] inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#547495] bg-white px-3 text-[13px] font-semibold text-[#244b70] transition hover:bg-blue hover:text-white max-sm:px-2" href="#search">
              <Icon name="arrow" size={14} /> See all shops
            </a>
          }
        />
        {searched && query.trim() && (
          <p className="-mt-3 mb-5 text-[15px] text-[#586e86]">
            Results for “{query.trim()}”{location && location !== "Your location" ? ` near ${location}` : ""}
          </p>
        )}
        {shops.length ? (
          <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3 md:gap-[19px]">
            {shops.map((shop) => <ShopCard key={shop.name} shop={shop} onDetails={onShopSelect} />)}
          </div>
        ) : (
          <div className="grid justify-items-center rounded-[13px] border border-[#e0e8f0] bg-white px-5 py-10 text-center">
            <span className="mb-2 grid size-[42px] place-items-center rounded-[10px] bg-[#e6eef7] text-[#345b7e]"><Icon name="search" size={22} /></span>
            <h3 className="my-1 text-[17px] font-semibold">No shops found for “{query.trim()}”</h3>
            <p className="my-2 mb-4 text-[15px] text-[#718198]">Try another repair category or browse all of our verified shops.</p>
            <button className="rounded-lg border border-[#547495] px-3 py-2 text-[13px] font-semibold text-[#244b70] hover:bg-blue hover:text-white" onClick={onReset}>
              Browse featured shops
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
