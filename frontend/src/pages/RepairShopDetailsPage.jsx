import { Link, useParams } from "react-router-dom";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import Icon from "../components/Icon.jsx";
import { repairShops } from "../data/repairShops.js";

const categoryIcons = {
  "Air Conditioner": "snow",
  Refrigerator: "fridge",
  "TV & Electronics": "tv",
  "Washing Machine": "washer",
  "Wi-Fi & Internet": "wifi",
  Electrical: "bolt",
};

export default function RepairShopDetailsPage() {
  const { shopId } = useParams();
  const shop = repairShops.find((item) => item.id === shopId);

  if (!shop) {
    return (
      <div className="min-h-screen bg-[#f0f3f7]">
        <Header />
        <main className="mx-auto max-w-[1200px] px-[18px] py-16 text-center">
          <h1 className="text-2xl font-bold text-navy">Shop not found</h1>
          <p className="mt-2 text-sm text-[#687b91]">This repair shop may no longer be available.</p>
          <Link className="mt-5 inline-flex rounded-lg bg-blue px-4 py-2.5 text-sm font-semibold text-white" to="/repair-shops">
            Browse repair shops
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const profile = shop.profile || {};
  const services = profile.servicesOffered || shop.services.map((name) => ({
    name,
    detail: `Diagnosis and ${name.toLowerCase()} service`,
    price: "Contact for price",
    icon: categoryIcons[shop.category] || "wrench",
  }));
  const reviews = profile.customerReviews || [];
  const serviceIcon = categoryIcons[shop.category] || "wrench";

  return (
    <div className="min-h-screen bg-[#f0f3f7] text-navy">
      <Header />
      <main className="mx-auto w-[calc(100%-36px)] max-w-[1200px] pb-10 pt-5 md:pb-16 md:pt-7">
        <section
          aria-label={`${shop.name} cover`}
          className="relative grid h-[150px] overflow-hidden rounded-[15px] bg-[#173f68] md:h-[220px]"
        >
          <span className="shop-cover-orb shop-cover-orb--left" />
          <span className="shop-cover-orb shop-cover-orb--right" />
          {shop.image && (
            <img
              alt={`${shop.name} repair service`}
              className="absolute inset-0 size-full object-cover opacity-70"
              src={shop.image}
            />
          )}
          <span className="absolute inset-0 bg-gradient-to-r from-[#102847]/75 via-[#102847]/35 to-transparent" />
          <Icon className="absolute right-[12%] top-1/2 -translate-y-1/2 text-[#6c8dad]" name={serviceIcon} size={112} />
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-medium text-[#315b82]">
            <Icon name="store" size={12} /> Shop cover photo
          </span>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 py-4 md:py-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-[58px] shrink-0 place-items-center rounded-xl border border-[#d6dfea] bg-white text-[#315b82] md:size-[72px]">
              <Icon name={serviceIcon} size={30} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-[20px] font-bold tracking-[-.4px] text-[#102847] md:text-[28px]">{shop.name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e1f3ea] px-2.5 py-1 text-[10px] font-semibold text-[#27805c]">
                  <Icon name="shieldCheck" size={12} /> Verified by HomeFix
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6a7b91]">
                <span className="inline-flex items-center gap-1 text-[#efa83d]"><Icon className="fill-[#efa83d]" name="star" size={12} /><b className="text-[#344b64]">{shop.rating.toFixed(1)}</b><span>({shop.reviews} reviews)</span></span>
                <span className="inline-flex items-center gap-1"><Icon name="pin" size={12} /> {profile.address || shop.location}</span>
                {profile.availableHours && (
                  <span className="inline-flex items-center gap-1 text-[#2b9a6e]"><span className="size-2 rounded-full bg-current" /> Open now · {profile.availableHours}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <a className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#315b82] bg-white px-4 text-xs font-semibold text-[#244b70] transition hover:bg-[#edf3f9] sm:flex-none" href={`tel:${shop.phone.replaceAll(" ", "")}`}>
              <Icon name="phone" size={14} /> Contact Shop
            </a>
            <Link className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue px-4 text-xs font-semibold text-white transition hover:bg-[#0c2e53] sm:flex-none" to="/request-repair">
              <Icon name="wrench" size={14} /> Request a Repair
            </Link>
          </div>
        </section>

        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(250px,.98fr)] md:gap-6">
          <div className="grid min-w-0 content-start gap-4">
            <section className="rounded-[14px] border border-[#d9e1e9] bg-white p-5 md:p-6">
              <h2 className="m-0 text-[16px] font-bold">About the shop</h2>
              <p className="mb-4 mt-3 text-[12px] leading-[1.7] text-[#687b91]">
                {profile.about || shop.description}
              </p>
              {(profile.yearsExperience || profile.jobsCompleted || profile.arrivalTime) && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {profile.yearsExperience && <ProfileStat icon="clock" value={profile.yearsExperience} label="Experience" />}
                  {profile.jobsCompleted && <ProfileStat icon="check" value={profile.jobsCompleted} label="Jobs completed" />}
                  {profile.arrivalTime && <ProfileStat icon="home" value={profile.arrivalTime} label="Home visit arrival" />}
                </div>
              )}
            </section>

            <section className="rounded-[14px] border border-[#d9e1e9] bg-white p-5 md:p-6">
              <h2 className="mb-4 mt-0 text-[16px] font-bold">Services offered</h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {services.map((service) => (
                  <article className="flex min-w-0 items-center gap-2.5 rounded-[10px] border border-[#d6dfea] p-2.5" key={service.name}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e5edf6] text-[#315b82]">
                      <Icon name={service.icon} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[11px] font-semibold">{service.name}</b>
                      <small className="mt-0.5 block truncate text-[9px] text-[#748498]">{service.detail}</small>
                    </span>
                    <span className="shrink-0 text-[9px] font-semibold text-[#244b70]">{service.price}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[14px] border border-[#d9e1e9] bg-white p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="m-0 text-[16px] font-bold">Customer reviews</h2>
                <Link className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#244b70] hover:underline" to="/login">
                  <Icon name="message" size={12} /> Write a review
                </Link>
              </div>
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 rounded-[11px] bg-[#f0f4f8] p-3 md:grid-cols-[100px_minmax(0,1fr)] md:p-4">
                <div className="text-center">
                  <strong className="block text-[34px] font-extrabold leading-none text-[#102847]">{shop.rating.toFixed(1)}</strong>
                  <span aria-label={`${shop.rating} out of 5 stars`} className="mt-1 block text-[13px] tracking-[1px] text-[#f3a229]">★★★★★</span>
                  <small className="block text-[9px] text-[#748498]">{shop.reviews} reviews</small>
                </div>
                {profile.ratingDistribution ? (
                  <div className="grid gap-1.5">
                    {profile.ratingDistribution.map((percentage, index) => {
                      const stars = 5 - index;
                      return (
                        <div className="grid grid-cols-[20px_minmax(0,1fr)_26px] items-center gap-2 text-[9px] text-[#60748a]" key={stars}>
                          <span className="font-semibold">{stars}★</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-[#d6dfe8]">
                            <span className="block h-full rounded-full bg-[#f3a229]" style={{ width: `${percentage}%` }} />
                          </span>
                          <span className="text-right">{percentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="m-0 text-[10px] text-[#748498]">Rating breakdown unavailable.</p>
                )}
              </div>
              {reviews.length ? (
                <div className="mt-3 divide-y divide-[#e5eaf0]">
                  {reviews.map((review) => (
                    <article className="py-3 first:pt-2 last:pb-0" key={`${review.name}-${review.date}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="grid size-7 place-items-center rounded-full bg-[#e5edf6] text-[#315b82]"><Icon name="user" size={14} /></span>
                          <span><b className="block text-[10px]">{review.name}</b><small className="text-[9px] text-[#8995a2]">{review.date}</small></span>
                        </div>
                        <span aria-label={`${review.rating || 5} out of 5 stars`} className="text-[10px] tracking-[1px] text-[#f3a229]">★★★★★</span>
                      </div>
                      <p className="mb-0 mt-1.5 text-[10px] leading-[1.55] text-[#687b91]">{review.text}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mb-0 mt-4 text-xs text-[#687b91]">No written reviews yet. Be the first to share your experience.</p>
              )}
            </section>
          </div>

          <aside className="grid content-start gap-4">
            <section className="rounded-[14px] border border-[#d9e1e9] bg-white p-5 shadow-[0_3px_10px_rgba(11,31,58,.04)]">
              <h2 className="mb-3 mt-0 text-[13px] font-bold">Service information</h2>
              <InfoRow icon="home" title={shop.serviceType === "Home service" ? "Home visit" : "In-shop service"} value={shop.serviceType === "Home service" ? "Available · arrives in ~2 hours" : "Available · visit the shop"} />
              <InfoRow icon="clock" title="Operating hours" value={profile.operatingHours || "Contact shop for opening hours"} />
              <InfoRow icon="pin" title="Service area" value={profile.serviceArea || shop.location} />
              <InfoRow icon="pin" title="Shop address" value={profile.address || shop.location} />
              <h3 className="mb-1 mt-3 text-[11px] font-bold">Contact details</h3>
              {shop.phone && <a className="flex items-center gap-2 py-1.5 text-[10px] font-semibold text-[#244b70] hover:underline" href={`tel:${shop.phone.replace(/[\s()-]/g, "")}`}><Icon name="phone" size={13} /> {shop.phone}</a>}
              {shop.email && <a className="flex items-center gap-2 py-1.5 text-[10px] font-semibold text-[#244b70] hover:underline" href={`mailto:${shop.email}`}><Icon name="mail" size={13} /> {shop.email}</a>}
              {shop.telegram && <a className="flex items-center gap-2 py-1.5 text-[10px] font-semibold text-[#244b70] hover:underline" href={`https://t.me/${shop.telegram}`} target="_blank" rel="noreferrer"><Icon name="message" size={13} /> @{shop.telegram}</a>}
              <Link className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue text-[11px] font-semibold text-white transition hover:bg-[#0c2e53]" to="/request-repair">
                <Icon name="wrench" size={13} /> Request a Repair
              </Link>
              <a className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#315b82] bg-white text-[11px] font-semibold text-[#244b70] transition hover:bg-[#edf3f9]" href={`tel:${shop.phone.replaceAll(" ", "")}`}>
                <Icon name="phone" size={13} /> Contact Shop
              </a>
              <p className="mb-0 mt-3 text-[9px] leading-[1.5] text-[#78899c]">Your request goes to the HomeFix team first — we confirm the visit with the shop and keep you updated.</p>
            </section>

            <section className="rounded-[14px] bg-[#fde9e7] p-5">
              <h2 className="m-0 flex items-center gap-1.5 text-[13px] font-bold text-[#9f292e]"><Icon name="alert" size={14} /> Is it urgent?</h2>
              <p className="mb-3 mt-2 text-[10px] leading-[1.6] text-[#755c63]">Use Emergency Service and we’ll find the fastest available technician for you.</p>
              <a className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-[#c9343b] px-3 text-[10px] font-semibold text-white hover:bg-[#ad252c]" href="tel:119">
                <Icon name="phone" size={12} /> Emergency Service
              </a>
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ProfileStat({ icon, value, label }) {
  return (
    <div className="flex min-h-[48px] items-center gap-2 rounded-[9px] bg-[#f0f4f8] px-2.5 py-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-[#315b82]"><Icon name={icon} size={14} /></span>
      <span><b className="block text-[11px] leading-tight">{value}</b><small className="text-[9px] text-[#748498]">{label}</small></span>
    </div>
  );
}

function InfoRow({ icon, title, value }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#e5edf6] text-[#315b82]"><Icon name={icon} size={14} /></span>
      <span className="min-w-0"><b className="block text-[10px] font-semibold">{title}</b><small className="mt-0.5 block text-[9px] leading-[1.5] text-[#748498]">{value}</small></span>
    </div>
  );
}
