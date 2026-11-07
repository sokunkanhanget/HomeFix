import Icon from "./Icon.jsx";

export default function ShopDetailsDialog({ shop, onClose }) {
  return (
    <div
      className="fixed inset-0 z-20 grid place-items-center bg-[#09192c]/60 p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="relative w-full max-w-[430px] rounded-[18px] bg-white p-[30px] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button
          className="absolute right-[15px] top-[14px] grid size-[34px] place-items-center rounded-full bg-[#f0f4f8] text-[23px] text-[#62758a]"
          aria-label="Close shop details"
          onClick={onClose}
        >
          ×
        </button>
        <span className="mb-3 grid size-[42px] place-items-center rounded-[10px] bg-[#e6eef7] text-[#345b7e]"><Icon name="store" size={24} /></span>
        <span className="flex items-center gap-1 text-[13px] font-bold text-[#258a62]"><Icon name="shieldCheck" size={12} /> Verified shop</span>
        <h2 className="mb-2 mt-2.5 text-[23px] font-bold text-navy" id="dialog-title">{shop.name}</h2>
        <div className="flex items-center gap-1 text-sm text-[#687a8e]">
          <Icon name="star" size={14} className="fill-[#efa83d] text-[#efa83d]" />
          {shop.rating} · {shop.reviews} reviews · {shop.category}
        </div>
        <p className="my-[17px] text-sm leading-[1.65] text-[#697b8e]">{shop.description}</p>
        <div className="mt-2.5 flex items-center gap-2 text-sm text-[#435a72]"><Icon name="pin" size={16} /> {shop.location}</div>
        <div className="mt-2.5 flex items-center gap-2 text-sm text-[#435a72]"><Icon name="phone" size={16} /> {shop.phone}</div>
        <a className="mt-[23px] inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue text-sm font-semibold text-white transition hover:bg-[#0c2e53]" href={`tel:${shop.phone.replaceAll(" ", "")}`}>
          Call this shop
        </a>
      </section>
    </div>
  );
}
