import { useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Icon from "../components/Icon.jsx";

const shops = [
  { name: "CoolTech AC Service", category: "Air Conditioner", rating: 4.8, reviews: 126, area: "Toul Kork", service: "Home service", tags: ["AC Repair", "AC Cleaning"], phone: "012 345 678", description: "AC cleaning, gas refill and repair for homes and offices. Same-day visits available.", verified: true },
  { name: "FrostFix Fridge Repair", category: "Refrigerator", rating: 4.7, reviews: 89, area: "Sen Sok", service: "In-shop repair", tags: ["Refrigerator", "Freezer"], phone: "015 882 410", description: "Refrigerator, freezer and water dispenser repair with genuine parts.", verified: true },
  { name: "BrightView Electronics", category: "TV & Electronics", rating: 4.6, reviews: 64, area: "Boeung Keng Kang", service: "Home service", tags: ["TV Repair", "Electronics"], phone: "017 220 915", description: "TV, speaker and home electronics repair. Free diagnosis in-shop.", verified: true },
  { name: "SpinClean Washer Care", category: "Washing Machine", rating: 4.9, reviews: 152, area: "Chamkar Mon", service: "Home service", tags: ["Washing Machine", "Dryer"], phone: "010 774 388", description: "Washing machine and dryer repair, drum cleaning and part replacement.", verified: true },
  { name: "NetHome Wi-Fi Setup", category: "Wi-Fi & Internet", rating: 4.5, reviews: 41, area: "Daun Penh", service: "Home service", tags: ["Wi-Fi", "CCTV"], phone: "096 551 1207", description: "Router setup, Wi-Fi dead-zone fixes and home CCTV installation.", verified: false },
  { name: "SafeWire Electrical", category: "Electrical", rating: 4.8, reviews: 97, area: "Mean Chey", service: "Home service", tags: ["Electrical", "Lighting"], phone: "088 610 342", description: "Licensed electricians for wiring, breakers and lighting — 24/7.", verified: true },
];
const categories = ["Air Conditioner", "Refrigerator", "TV & Electronics", "Washing Machine", "Wi-Fi & Internet", "Electrical", "Plumbing"];
const areas = ["Toul Kork", "Sen Sok", "Boeung Keng Kang", "Chamkar Mon", "Daun Penh", "Mean Chey"];

export default function FindRepairShopsPage() {
  const [query, setQuery] = useState("Air conditioner");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [location, setLocation] = useState("Toul Kork");
  const [category, setCategory] = useState("Air Conditioner");
  const [service, setService] = useState("Home service");
  const [rating, setRating] = useState("4.5");
  const [sort, setSort] = useState("Relevance");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [applied, setApplied] = useState({ category: "", location: "", service: "", rating: "0" });
  const filtered = useMemo(() => {
    const q = submittedQuery.trim().toLowerCase();
    let result = shops.filter((shop) => (!q || `${shop.name} ${shop.category} ${shop.tags.join(" ")}`.toLowerCase().includes(q)) && (!applied.category || shop.category === applied.category) && (!applied.location || shop.area === applied.location) && (!applied.service || shop.service === applied.service) && shop.rating >= Number(applied.rating || 0));
    if (sort === "Rating") result = [...result].sort((a, b) => b.rating - a.rating);
    if (sort === "Most reviewed") result = [...result].sort((a, b) => b.reviews - a.reviews);
    return result;
  }, [submittedQuery, applied, sort]);
  const visibleShops = filtered;
  const apply = () => { setApplied({ category, location, service: service === "Any" ? "" : service, rating: rating === "Any rating" ? "0" : rating }); setPage(1); };
  const clear = () => { setCategory(""); setLocation(""); setService("Any"); setRating("Any rating"); setApplied({ category: "", location: "", service: "", rating: "0" }); setQuery(""); setSubmittedQuery(""); setPage(1); };

  return <div className="min-h-screen bg-white text-[#102847]"><Header />
    <section className="bg-[#f0f4f9] px-[18px] py-8 md:px-0 md:py-9">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-4 flex items-center gap-2 text-xs text-[#60748d]"><a href="/">Home</a><span>›</span><span className="font-semibold text-[#102847]">Find Repair Shops</span></div>
        <h1 className="m-0 text-[30px] font-bold tracking-[-1.2px] md:text-[38px]">Find Repair Shops Near You</h1>
        <p className="mb-5 mt-2 text-sm text-[#64758b]">Search by shop name or appliance, then filter by area, service type and rating.</p>
        <form className="grid gap-2 rounded-xl bg-white p-2 shadow-[0_3px_12px_rgba(16,40,71,.1)] md:grid-cols-[1.2fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); setSubmittedQuery(query); setApplied((prev) => ({ ...prev, location })); setPage(1); }}>
          <label className="flex h-10 items-center gap-2 px-3 text-[#1b4b7a]"><Icon name="search" size={16}/><input className="w-full bg-transparent text-sm text-[#102847] outline-none placeholder:text-[#8997a8]" aria-label="Search shops or appliances" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Shop name or appliance" /></label>
          <label className="flex h-10 items-center gap-2 px-3 text-[#1b4b7a]"><Icon name="pin" size={16}/><select aria-label="Search location" className="w-full bg-transparent text-sm text-[#102847] outline-none" value={location} onChange={(e) => setLocation(e.target.value)}><option value="">All Phnom Penh</option>{areas.map((area) => <option key={area}>{area}</option>)}</select></label>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#123b66] px-5 text-sm font-semibold text-white hover:bg-[#0c2e53]" type="submit"><Icon name="search" size={15}/>Search</button>
        </form>
      </div>
    </section>

    <main className="mx-auto grid max-w-[1200px] gap-6 px-[18px] py-8 md:grid-cols-[250px_1fr] md:gap-8 md:px-0 md:py-10">
      <button className="flex items-center justify-center gap-2 rounded-lg border border-[#d6dfea] py-3 text-sm font-semibold md:hidden" type="button" onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="search" size={15}/> {filtersOpen ? "Hide filters" : "Show filters"}</button>
      <aside className={`${filtersOpen ? "block" : "hidden"} h-fit rounded-xl border border-[#d6dfea] p-5 md:block`}>
        <div className="flex items-center justify-between border-b border-[#dce4ed] pb-4"><h2 className="m-0 flex items-center gap-2 text-sm font-bold"><span>▽</span> Filters</h2><button type="button" className="text-xs font-semibold text-[#315b82]" onClick={clear}>Clear all</button></div>
        <fieldset className="border-b border-[#dce4ed] py-4"><legend className="mb-2 text-xs font-bold">Repair category</legend>{categories.map((item) => <label key={item} className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-[#344b66]"><input type="radio" name="category" checked={category === item} onChange={() => setCategory(item)} className="accent-[#123b66]"/>{item}</label>)}</fieldset>
        <label className="block border-b border-[#dce4ed] py-4 text-xs font-bold">Location or district<select className="mt-2 w-full rounded-lg border border-[#d6dfea] bg-white px-2 py-2.5 text-xs font-normal" value={location} onChange={(e) => setLocation(e.target.value)}><option value="">Any area</option>{areas.map((area) => <option key={area}>{area}</option>)}</select></label>
        <fieldset className="border-b border-[#dce4ed] py-4"><legend className="mb-2 text-xs font-bold">Service type</legend>{["Any", "Home service", "In-shop repair"].map((item) => <label key={item} className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-[#344b66]"><input type="radio" name="service" checked={service === item} onChange={() => setService(item)} className="accent-[#123b66]"/>{item}</label>)}</fieldset>
        <fieldset className="py-4"><legend className="mb-2 text-xs font-bold">Rating</legend>{["4.5", "4.0", "Any rating"].map((item) => <label key={item} className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-[#344b66]"><input type="radio" name="rating" checked={rating === item} onChange={() => setRating(item)} className="accent-[#123b66]"/>{item === "Any rating" ? "Any rating" : `${item} & up`}</label>)}</fieldset>
        <button type="button" onClick={apply} className="w-full rounded-lg bg-[#123b66] py-2.5 text-xs font-semibold text-white hover:bg-[#0c2e53]">Apply filters</button>
      </aside>

      <section>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-sm font-semibold">Showing {filtered.length} of 48 shops</p><div className="mt-2 flex flex-wrap gap-1.5">{[applied.category || category, applied.location || location, applied.service || service, Number(applied.rating) ? `${applied.rating} & up` : rating !== "Any rating" ? `${rating} & up` : ""].filter(Boolean).map((tag) => <span key={tag} className="rounded-full bg-[#e5edf5] px-2.5 py-1 text-[10px] text-[#315b82]">{tag} <button aria-label={`Remove ${tag} filter`} onClick={clear}>×</button></span>)}</div></div><label className="flex items-center gap-1 text-xs">Sort by: <select className="rounded-lg border border-[#d6dfea] bg-white px-2 py-2 text-xs" value={sort} onChange={(e) => setSort(e.target.value)}><option>Relevance</option><option>Rating</option><option>Most reviewed</option></select></label></div>
        {visibleShops.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleShops.map((shop) => <article key={shop.name} className="overflow-hidden rounded-xl border border-[#d6dfea] bg-white shadow-[0_3px_10px_rgba(16,40,71,.07)]"><div className="relative grid h-[142px] place-items-center bg-[#dce6f0] text-[#85a5c3]"><Icon name="store" size={34}/>{shop.verified && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#e3f4ec] px-2 py-1 text-[10px] font-semibold text-[#258a62]"><Icon name="shieldCheck" size={12}/> Verified</span>}</div><div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="m-0 text-[15px] font-bold leading-5">{shop.name}</h3><span className="shrink-0 text-[10px] text-[#46617d]"><b className="text-[#efa83d]">★</b> {shop.rating} <span className="text-[#8190a3]">({shop.reviews})</span></span></div><p className="mb-3 mt-2 min-h-[40px] text-[11px] leading-[1.55] text-[#718197]">{shop.description}</p><div className="mb-2 flex flex-wrap gap-1.5">{shop.tags.map((tag) => <span className="rounded-full bg-[#e5edf5] px-2 py-1 text-[10px] text-[#315b82]" key={tag}>{tag}</span>)}</div><p className="mb-1 flex items-center gap-1.5 text-[10px] text-[#718197]"><Icon name="pin" size={13}/>{shop.area}, Phnom Penh</p><a className="mb-3 flex items-center gap-1.5 text-[10px] text-[#718197]" href={`tel:${shop.phone.replaceAll(" ", "")}`}><Icon name="phone" size={13}/>{shop.phone}</a><button className="w-full rounded-lg border border-[#123b66] py-2 text-[11px] font-semibold text-[#123b66] hover:bg-[#f0f4f9]" type="button" onClick={() => window.alert(`${shop.name}\n${shop.description}\nPhone: ${shop.phone}`)}>View Details</button></div></article>)}</div> : <p className="rounded-xl border border-[#d6dfea] p-8 text-center text-sm text-[#64758b]">No shops match those filters. Try another area or clear your filters.</p>}
        <nav aria-label="Shop results pages" className="mt-8 flex items-center justify-center gap-2 text-xs"><button className="px-2 py-2" onClick={() => setPage(Math.max(1, page - 1))}>Previous</button>{[1, 2, 3, "…", 8].map((n, i) => <button key={`${n}-${i}`} className={`grid size-8 place-items-center rounded-md border ${page === n ? "border-[#123b66] bg-[#123b66] text-white" : "border-[#d6dfea] hover:bg-[#f0f4f9]"}`} onClick={() => typeof n === "number" && setPage(n)}>{n}</button>)}<button className="px-2 py-2" onClick={() => setPage(Math.min(8, page + 1))}>➜ &nbsp;Next</button></nav>
      </section>
    </main>
    <Footer />
  </div>;
}
