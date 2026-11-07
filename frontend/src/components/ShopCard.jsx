import Icon from "./Icon.jsx";

export default function ShopCard({ shop, onDetails }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-[13px] border border-[#e2e8ef] bg-white shadow-sm">
      <div className="relative grid h-[115px] place-items-center bg-[#dce7f1] text-[#a9bfd3] md:h-[140px]">
        <span className="absolute left-[13px] top-[13px] inline-flex items-center gap-1 rounded-full bg-[#f2fbf6] px-2 py-1 text-[13px] font-bold text-[#258a62]">
          <Icon name="shieldCheck" size={12} /> Verified
        </span>
        <Icon name="store" size={30} className="text-[#9db5cc]" />
      </div>
      <div className="flex min-h-[215px] flex-col p-[14px] md:px-4">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-start md:justify-between md:gap-2">
          <h3 className="m-0 text-[15px] font-bold text-[#203851]">{shop.name}</h3>
          <span className="inline-flex items-center gap-[3px] text-[13px] font-bold text-[#30455d]">
            <Icon name="star" size={12} className="fill-[#efa83d] text-[#efa83d]" />
            {shop.rating} <small className="text-xs font-normal text-[#8995a2]">({shop.reviews})</small>
          </span>
        </div>
        <p className="my-2 min-h-[35px] text-[13px] leading-[1.55] text-[#7b8998]">{shop.description}</p>
        <div className="mb-2 flex gap-1">
          <span className="rounded bg-[#edf3f9] px-1.5 py-1 text-xs font-semibold text-[#456b8c]">{shop.category}</span>
          <span className="rounded bg-[#edf3f9] px-1.5 py-1 text-xs font-semibold text-[#456b8c]">Same-day</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[13px] text-[#738295]"><Icon name="pin" size={13} /> {shop.location}</div>
        <div className="mt-1 flex items-center gap-1 text-[13px] text-[#738295]"><Icon name="phone" size={13} /> {shop.phone}</div>
        <button
          className="mt-auto inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#547495] bg-white text-[13px] font-semibold text-[#244b70] transition hover:bg-blue hover:text-white"
          onClick={() => onDetails(shop)}
        >
          View Details
        </button>
      </div>
    </article>
  );
}
