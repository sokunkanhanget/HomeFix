import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import Icon from "../components/Icon.jsx";
import { repairShops } from "../data/repairShops.js";

const categories = [
  "Air Conditioner",
  "Refrigerator",
  "TV & Electronics",
  "Washing Machine",
  "Wi-Fi & Internet",
  "Electrical",
  "Plumbing",
];
const districts = [
  "All areas",
  "Toul Kork",
  "Sen Sok",
  "Boeung Keng Kang",
  "Chamkar Mon",
  "Daun Penh",
  "Mean Chey",
];
const initialFilters = {
  categories: ["Air Conditioner"],
  district: "Toul Kork",
  service: "Home service",
  rating: "4.5 & up",
};

export default function RepairShopsPage() {
  const [query, setQuery] = useState("Air conditioner");
  const [locationQuery, setLocationQuery] = useState("Toul Kork, Phnom Penh");
  const [filters, setFilters] = useState(initialFilters);
  const [showDefaultTags, setShowDefaultTags] = useState(true);
  const [applied, setApplied] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);

  const visibleShops = useMemo(() => {
    const matches = repairShops.filter((shop) => {
      if (!applied) return true;
      const searchTerm = query.trim().toLowerCase();
      const locationTerm = locationQuery.trim().toLowerCase();
      const matchesQuery =
        !searchTerm ||
        [shop.name, shop.category, shop.description, ...shop.services]
          .some((value) => value.toLowerCase().includes(searchTerm));
      const matchesLocation = !locationTerm || shop.location.toLowerCase().includes(locationTerm);
      const matchesCategory =
        filters.categories.length === 0 || filters.categories.includes(shop.category);
      const matchesDistrict =
        filters.district === "All areas" || shop.location.startsWith(filters.district);
      const matchesService =
        filters.service === "Any" || shop.serviceType === filters.service;
      const minimumRating = filters.rating === "4.5 & up" ? 4.5 : filters.rating === "4.0 & up" ? 4 : 0;
      return (
        matchesQuery &&
        matchesLocation &&
        matchesCategory &&
        matchesDistrict &&
        matchesService &&
        shop.rating >= minimumRating
      );
    });

    return [...matches].sort((a, b) => {
      if (sort === "rating-high") return b.rating - a.rating;
      if (sort === "rating-low") return a.rating - b.rating;
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [applied, filters, locationQuery, query, sort]);

  const activeFilters = [
    ...filters.categories,
    ...(filters.district !== "All areas" ? [filters.district] : []),
    ...(filters.service !== "Any" ? [filters.service] : []),
    ...(filters.rating !== "Any rating" ? [filters.rating] : []),
  ];

  function updateFilters(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setShowDefaultTags(false);
    setPage(1);
  }

  function toggleCategory(category) {
    const selected = filters.categories.includes(category);
    updateFilters(
      "categories",
      selected
        ? filters.categories.filter((item) => item !== category)
        : [...filters.categories, category],
    );
  }

  function applyFilters(event) {
    event?.preventDefault();
    setApplied(true);
    setPage(1);
  }

  function clearFilters() {
    setFilters({ categories: [], district: "All areas", service: "Any", rating: "Any rating" });
    setQuery("");
    setLocationQuery("");
    setShowDefaultTags(false);
    setApplied(false);
    setPage(1);
  }

  return (
    <div className="repair-directory-page min-h-screen bg-white text-navy">
      <Header />
      <section className="repair-directory-search bg-[#f0f4f9]">
        <div className="mx-auto w-[calc(100%-36px)] max-w-[1200px] py-7 md:py-8">
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-[12px] text-[#60748d]">
            <Link to="/">Home</Link><span aria-hidden="true">›</span><span className="font-semibold text-[#102847]">Find Repair Shops</span>
          </nav>
          <h1 className="m-0 text-[30px] font-bold leading-tight tracking-[-1.1px] text-[#102847] md:text-[36px]">Find Repair Shops Near You</h1>
          <p className="mb-5 mt-2 text-[14px] text-[#64748b]">
            Search by shop name or appliance, then filter by area, service type and rating.
          </p>
          <form
            className="flex min-h-[52px] flex-wrap items-center rounded-[12px] bg-white p-1.5 shadow-[0_3px_10px_rgba(16,40,71,.08)]"
            onSubmit={applyFilters}
          >
            <label className="flex min-h-[40px] min-w-[180px] flex-1 items-center gap-2 px-3 text-[#234d75]">
              <Icon name="search" size={16} />
              <input
                aria-label="Search by shop or appliance"
                className="w-full min-w-0 bg-transparent py-2 text-[14px] text-[#203851] outline-none placeholder:text-[#8996a5]"
                placeholder="Shop name or appliance"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="flex min-h-[40px] min-w-[180px] flex-1 items-center gap-2 border-l border-[#e4e9ef] px-3 text-[#234d75] max-[520px]:border-0">
              <Icon name="pin" size={16} />
              <input
                aria-label="Location"
                className="w-full min-w-0 bg-transparent py-2 text-[14px] text-[#203851] outline-none placeholder:text-[#8996a5]"
                placeholder="Area or district"
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
              />
            </label>
            <button
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-blue px-5 text-[13px] font-semibold text-white transition hover:bg-[#0c2e53] max-[520px]:w-full"
              type="submit"
            >
              <Icon name="search" size={14} /> Search
            </button>
          </form>
        </div>
      </section>

      <main className="mx-auto grid w-[calc(100%-36px)] max-w-[1200px] gap-6 py-7 md:grid-cols-[244px_minmax(0,1fr)] md:gap-7">
        <aside className="repair-directory-filters self-start rounded-[13px] border border-[#d6dfea] bg-white p-4">
          <div className="flex items-center justify-between border-b border-[#d6dfea] pb-3">
            <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
              <Icon name="filter" size={16} /> Filters
            </h2>
            <button className="text-[12px] font-medium text-[#315b82] hover:underline" onClick={clearFilters} type="button">
              Clear all
            </button>
          </div>

          <fieldset className="border-b border-[#e1e7ee] py-3">
            <legend className="mb-2 text-[12px] font-bold">Repair category</legend>
            <div className="grid gap-2">
              {categories.map((category) => (
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#52657b]" key={category}>
                  <input
                    checked={filters.categories.includes(category)}
                    className="size-[14px] accent-[#163f6b]"
                    onChange={() => toggleCategory(category)}
                    type="checkbox"
                  />
                  {category}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-2 border-b border-[#e1e7ee] py-3 text-[12px] font-bold">
            Location or district
            <span className="relative">
              <Icon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#315b82]" name="pin" size={14} />
              <select
                aria-label="Filter by location or district"
                className="w-full appearance-none rounded-md border border-[#d6dfea] bg-white py-2 pl-8 pr-8 text-[12px] font-normal text-[#40556c] outline-none focus:border-[#315b82]"
                onChange={(event) => updateFilters("district", event.target.value)}
                value={filters.district}
              >
                {districts.map((district) => <option key={district}>{district}</option>)}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#315b82]">⌄</span>
            </span>
          </label>

          <fieldset className="border-b border-[#e1e7ee] py-3">
            <legend className="mb-2 text-[12px] font-bold">Service type</legend>
            <div className="grid gap-2">
              {["Any", "Home service", "In-shop repair"].map((service) => (
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#52657b]" key={service}>
                  <input
                    checked={filters.service === service}
                    className="size-[14px] accent-[#163f6b]"
                    name="serviceType"
                    onChange={() => updateFilters("service", service)}
                    type="radio"
                  />
                  {service}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="py-3">
            <legend className="mb-2 text-[12px] font-bold">Rating</legend>
            <div className="grid gap-2">
              {["4.5 & up", "4.0 & up", "Any rating"].map((rating) => (
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#52657b]" key={rating}>
                  <input
                    checked={filters.rating === rating}
                    className="size-[14px] accent-[#163f6b]"
                    name="rating"
                    onChange={() => updateFilters("rating", rating)}
                    type="radio"
                  />
                  {rating}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            className="min-h-[36px] w-full rounded-lg bg-blue text-[12px] font-semibold text-white transition hover:bg-[#0c2e53]"
            onClick={applyFilters}
            type="button"
          >
            Apply filters
          </button>
        </aside>

        <section aria-label="Repair shop results" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 text-[13px] font-semibold text-[#263e58]">
                Showing {visibleShops.length} of {applied ? visibleShops.length : 48} shops
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(applied ? activeFilters : showDefaultTags ? ["Air Conditioner", "Toul Kork", "Home service", "4.5 & up"] : []).map((filter) => (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e7eef6] px-2.5 py-1 text-[11px] font-medium text-[#315b82]" key={filter}>
                    {filter}
                    <button
                      aria-label={`Remove ${filter} filter`}
                      className="text-[#71869b] hover:text-[#163f6b]"
                      onClick={() => {
                        if (filters.categories.includes(filter)) toggleCategory(filter);
                        else if (filter === filters.district) updateFilters("district", "All areas");
                        else if (filter === filters.service) updateFilters("service", "Any");
                        else if (filter === filters.rating) updateFilters("rating", "Any rating");
                        setApplied(true);
                      }}
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[#54677d]">
              Sort by:
              <select
                aria-label="Sort shops"
                className="min-h-[36px] rounded-md border border-[#d6dfea] bg-white px-2 text-[12px] text-[#344b64] outline-none focus:border-[#315b82]"
                onChange={(event) => setSort(event.target.value)}
                value={sort}
              >
                <option value="relevance">Relevance</option>
                <option value="rating-high">Highest rated</option>
                <option value="rating-low">Lowest rated</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>

          {visibleShops.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
 feature/find-repair-shops
              {visibleShops.map((shop) => (
                <DirectoryShopCard key={shop.name} shop={shop} />
              ))}
=======
              {visibleShops.map((shop) => <DirectoryShopCard key={shop.id} shop={shop} />)}
 main
            </div>
          ) : (
            <div className="rounded-xl border border-[#d6dfea] bg-white px-5 py-12 text-center">
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="search" size={20} /></span>
              <h2 className="mb-2 mt-4 text-base font-bold">No repair shops found</h2>
              <p className="m-0 text-sm text-[#718198]">Try changing your search or clearing some filters.</p>
              <button className="mt-4 text-sm font-semibold text-[#315b82] hover:underline" onClick={clearFilters} type="button">Clear filters</button>
            </div>
          )}

          {!applied && (
            <nav aria-label="Shop pages" className="mt-7 flex items-center justify-center gap-2 text-[12px]">
              <button className="px-2 py-2 text-[#163f6b] hover:underline" onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Previous</button>
              {[1, 2, 3].map((number) => (
                <button
                  aria-current={page === number ? "page" : undefined}
                  className={`grid size-8 place-items-center rounded-md border ${page === number ? "border-blue bg-blue font-semibold text-white" : "border-[#d6dfea] bg-white text-[#315b82] hover:bg-[#f0f4f8]"}`}
                  key={number}
                  onClick={() => setPage(number)}
                  type="button"
                >
                  {number}
                </button>
              ))}
              <span className="px-1 text-[#60748a]">…</span>
              <button
                aria-current={page === 8 ? "page" : undefined}
                className={`grid size-8 place-items-center rounded-md border ${page === 8 ? "border-blue bg-blue font-semibold text-white" : "border-[#d6dfea] bg-white text-[#315b82] hover:bg-[#f0f4f8]"}`}
                onClick={() => setPage(8)}
                type="button"
              >
                8
              </button>
              <button className="flex items-center gap-1 px-2 py-2 text-[#163f6b] hover:underline" onClick={() => setPage((current) => Math.min(8, current + 1))} type="button">
                <Icon name="arrow" size={13} /> Next
              </button>
            </nav>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function DirectoryShopCard({ shop }) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[12px] border border-[#dce4ec] bg-white shadow-[0_3px_10px_rgba(11,31,58,.05)]">
      <div className="relative grid h-[94px] shrink-0 place-items-center bg-[#dce7f1] text-[#9db5cc]">
        {shop.image && (
          <img
            alt={`${shop.name} repair service`}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            src={shop.image}
          />
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#effaf4] px-2 py-1 text-[10px] font-semibold text-[#258a62]">
          <Icon name="shieldCheck" size={11} /> Verified
        </span>
        {!shop.image && <Icon name="store" size={25} />}
      </div>
      <div className="flex min-h-[184px] flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="m-0 text-[13px] font-bold leading-[1.4] text-[#203851]">{shop.name}</h3>
          <span className="inline-flex shrink-0 items-center gap-0.5 pt-0.5 text-[10px] font-semibold text-[#354b63]">
            <Icon name="star" size={10} className="fill-[#efa83d] text-[#efa83d]" />
            {shop.rating.toFixed(1)} <small className="font-normal text-[#8995a2]">({shop.reviews})</small>
          </span>
        </div>
        <p className="my-1.5 line-clamp-2 min-h-[31px] text-[10px] leading-[1.5] text-[#748498]">{shop.description}</p>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {shop.services.map((service) => (
            <span className="rounded-full bg-[#e7eef6] px-1.5 py-0.5 text-[9px] font-medium text-[#456b8c]" key={service}>{service}</span>
          ))}
          {shop.services.length < 3 && (
            <span className="rounded-full bg-[#e7eef6] px-1.5 py-0.5 text-[9px] font-medium text-[#456b8c]">+1</span>
          )}
        </div>
        <div className="mt-auto grid gap-1 text-[10px] leading-[1.4] text-[#738295]">
          <span className="flex items-center gap-1"><Icon name="pin" size={11} /> {shop.location}</span>
          <span className="flex items-center gap-1"><Icon name="phone" size={11} /> {shop.phone}</span>
        </div>
        <Link
          className="mt-2 inline-flex min-h-[31px] w-full items-center justify-center rounded-md border border-[#315b82] bg-white text-[10px] font-semibold text-[#244b70] transition hover:bg-blue hover:text-white"
 feature/find-repair-shops
          to={`/repair-shops/${shop.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
=======
          to={`/repair-shops/${shop.id}`}
 main
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
