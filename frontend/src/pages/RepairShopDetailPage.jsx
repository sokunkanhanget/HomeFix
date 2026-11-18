import { Link, useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Icon from "../components/Icon.jsx";
import { repairShops } from "../data/repairShops.js";

const detailContent = {
  "cooltech-ac-service": {
    years: "8 years", jobs: "1,200+", arrival: "~2 hours",
    about: "CoolTech has been keeping Phnom Penh homes cool since 2018. Our certified technicians handle everything from routine AC cleaning to compressor repair and refrigerator faults — and we come to you. We give a price before we start, use genuine parts, and back every repair with a 30-day warranty.",
    services: [["snow", "AC Repair", "Not cooling, noise, leaks", "From $15"], ["drop", "AC Cleaning", "Indoor + outdoor unit wash", "From $10"], ["bolt", "Gas Refill", "R32 / R410A refrigerant", "From $25"], ["wrench", "AC Installation", "New or relocated units", "From $35"], ["fridge", "Refrigerator Repair", "Cooling, ice build-up, noise", "From $20"], ["calendar", "Maintenance Plan", "Quarterly check-ups", "From $8 / mo"]],
    areas: "Toul Kork, Sen Sok, 7 Makara, Daun Penh",
  },
};

const reviews = [
  { name: "Sopheak K.", time: "2 days ago", text: "Called in the morning, technician arrived before lunch. AC is ice cold again and the price matched the quote." },
  { name: "Dara M.", time: "1 week ago", text: "Very professional — cleaned both units and showed me photos of the dirty filters. Will book the maintenance plan." },
  { name: "Lina T.", time: "3 weeks ago", text: "Fridge stopped cooling on a Sunday. They still came and fixed the fan motor. Great service." },
];

export default function RepairShopDetailPage() {
  const { shopSlug } = useParams();
  const shop = repairShops.find((item) => slugify(item.name) === shopSlug);
  if (!shop) return <div className="min-h-screen bg-white text-[#102847]"><Header/><main className="mx-auto max-w-[900px] px-5 py-24 text-center"><h1 className="text-3xl font-bold">Shop not found</h1><p className="text-[#6b7c91]">This repair shop may have moved or is no longer listed.</p><Link className="mt-4 inline-flex rounded-lg bg-[#163f6b] px-5 py-3 text-sm font-semibold text-white" to="/repair-shops">Back to repair shops</Link></main><Footer/></div>;

  const detail = detailContent[shopSlug] || { years: "5 years", jobs: "500+", arrival: "Same day", about: shop.description, services: shop.services.map((service) => ["wrench", service, "Professional service and repair", "Call for price"]), areas: shop.location };
  return <div className="repair-shop-detail-page min-h-screen bg-white text-[#102847]"><Header/>
    <section className="mx-auto max-w-[1200px] px-[18px] pb-6 pt-5 md:px-0">
      <div className="mb-4 flex items-center gap-2 text-[11px] text-[#6b7c91]"><Link to="/">Home</Link><span>›</span><Link to="/repair-shops">Find Repair Shops</Link><span>›</span><span className="font-semibold text-[#102847]">{shop.name}</span></div>
      <div className="relative h-[150px] overflow-hidden rounded-xl bg-[#173f6b] md:h-[205px]"><div className="absolute -right-12 -top-20 size-64 rounded-full bg-white/[.035]"/><div className="absolute -bottom-16 -left-10 size-40 rounded-full bg-white/[.025]"/><Icon name={shop.category === "Air Conditioner" ? "snow" : "store"} size={88} className="absolute right-[12%] top-1/2 -translate-y-1/2 text-[#8caecc]/35"/><span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-[10px] text-[#315b82]">▣ Shop cover photo</span></div>
      <div className="flex flex-wrap items-center gap-3 py-4 md:gap-4"><div className="grid size-[58px] shrink-0 place-items-center rounded-xl border border-[#d7e1eb] bg-white text-[#315b82] shadow-sm"><Icon name={shop.category === "Air Conditioner" ? "snow" : "store"} size={30}/></div><div className="min-w-[210px] flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="m-0 text-[24px] font-bold tracking-[-.7px] md:text-[30px]">{shop.name}</h1><span className="inline-flex items-center gap-1 rounded-full bg-[#e5f5ed] px-2 py-1 text-[10px] font-semibold text-[#258a62]"><Icon name="shieldCheck" size={12}/> Verified by HomeFix</span></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#708198]"><span className="text-[#efa83d]">★ <b className="text-[#344b66]">{shop.rating.toFixed(1)}</b> ({shop.reviews} reviews)</span><span className="flex items-center gap-1"><Icon name="pin" size={12}/>{shop.location}</span><span className="flex items-center gap-1 text-[#258a62]"><Icon name="clock" size={12}/>Open now · 8:00 AM – 7:00 PM</span></div></div><div className="flex w-full gap-2 sm:w-auto"><a className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-[#163f6b] px-3 text-[11px] font-semibold text-[#163f6b] sm:flex-none" href={`tel:${shop.phone.replaceAll(" ", "")}`}><Icon name="phone" size={13}/>Contact Shop</a><Link className="request-repair-button inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#163f6b] px-3 text-[11px] font-semibold sm:flex-none" to="/request-repair"><Icon name="wrench" size={13}/>Request a Repair</Link></div></div>
    </section>
    <main className="bg-[#f0f4f9] px-[18px] py-6 md:py-8"><div className="mx-auto grid max-w-[1200px] items-start gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:gap-6">
      <div className="grid gap-4">
        <section className="rounded-xl border border-[#dbe3ec] bg-white p-5 md:p-6"><h2 className="m-0 text-base font-bold">About the shop</h2><p className="mb-4 mt-3 text-[12px] leading-[1.65] text-[#718197]">{detail.about}</p><div className="grid gap-2 sm:grid-cols-3">{[["clock", detail.years, "Experience"], ["check", detail.jobs, "Jobs completed"], ["home", detail.arrival, "Home visit arrival"]].map(([icon, value, label]) => <div key={label} className="flex items-center gap-2 rounded-lg bg-[#f0f4f8] p-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-[#163f6b]"><Icon name={icon} size={15}/></span><span><b className="block text-[12px]">{value}</b><small className="text-[10px] text-[#718197]">{label}</small></span></div>)}</div></section>
        <section className="rounded-xl border border-[#dbe3ec] bg-white p-5 md:p-6"><h2 className="mb-3 mt-0 text-base font-bold">Services offered</h2><div className="grid gap-2 sm:grid-cols-2">{detail.services.map(([icon, name, description, price]) => <article key={name} className="flex items-center gap-2 rounded-lg border border-[#e0e7ef] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e4edf6] text-[#315b82]"><Icon name={icon} size={17}/></span><div className="min-w-0 flex-1"><h3 className="m-0 text-[11px] font-bold">{name}</h3><p className="m-0 mt-0.5 truncate text-[9px] text-[#718197]">{description}</p></div><b className="shrink-0 text-[9px] text-[#163f6b]">{price}</b></article>)}</div></section>
        <section className="rounded-xl border border-[#dbe3ec] bg-white p-5 md:p-6"><div className="mb-3 flex items-center justify-between"><h2 className="m-0 text-base font-bold">Customer reviews</h2><Link className="text-[10px] font-semibold text-[#163f6b]" to="/login">▢ &nbsp;Write a review</Link></div><div className="grid gap-3 rounded-lg bg-[#f0f4f8] p-4 sm:grid-cols-[100px_1fr]"><div><b className="block text-[30px] leading-none">{shop.rating.toFixed(1)}</b><span className="text-sm tracking-[1px] text-[#efa83d]">★★★★★</span><small className="block text-[9px] text-[#718197]">{shop.reviews} reviews</small></div><div className="grid content-center gap-1.5">{[ ["5★", "82%"], ["4★", "12%"], ["3★", "4%"], ["2★", "1%"], ["1★", "1%"] ].map(([label, pct]) => <div className="flex items-center gap-2 text-[9px] text-[#718197]" key={label}><span className="w-4">{label}</span><span className="h-1 flex-1 overflow-hidden rounded bg-[#d8e1eb]"><span className="block h-full rounded bg-[#efa83d]" style={{width:pct}}/></span><span className="w-7 text-right">{pct}</span></div>)}</div></div><div className="mt-2 divide-y divide-[#edf0f4]">{reviews.map((review) => <article className="py-3" key={review.name}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#e4edf6] text-[#315b82]"><Icon name="user" size={13}/></span><span><b className="block text-[10px]">{review.name}</b><small className="text-[9px] text-[#718197]">{review.time}</small></span></div><span className="text-[10px] text-[#efa83d]">★★★★★</span></div><p className="mb-0 mt-2 text-[10px] leading-4 text-[#718197]">{review.text}</p></article>)}</div></section>
      </div>
      <aside className="grid gap-4">
        <section className="rounded-xl border border-[#dbe3ec] bg-white p-5">
          <h2 className="mb-4 mt-0 text-sm font-bold">Service information</h2>
          <Info icon="home" title="Home visits" detail="Available · arrival in 1–2 hours"/>
          <Info icon="clock" title="Operating hours" detail="Mon–Sat 8:00–19:00 · Sun 9:00–17:00"/>
          <Info icon="pin" title="Service area" detail={detail.areas}/>
          <Info icon="pin" title="Shop address" detail={shop.profile?.address || shop.location}/>
        </section>
        <section className="rounded-xl border border-[#dbe3ec] bg-white p-5">
          <h2 className="mb-3 mt-0 text-sm font-bold">Contact shop</h2>
          {shop.phone && <a className="mb-2 flex min-h-10 items-center gap-2.5 rounded-lg border border-[#dbe3ec] px-3 text-[11px] font-semibold text-[#244b70] hover:bg-[#f0f4f8]" href={`tel:${shop.phone.replace(/[\s()-]/g, "")}`}><span className="grid size-7 place-items-center rounded-md bg-[#e4edf6] text-[#315b82]"><Icon name="phone" size={13}/></span>{shop.phone}</a>}
          {shop.email && <a className="mb-2 flex min-h-10 items-center gap-2.5 rounded-lg border border-[#dbe3ec] px-3 text-[11px] font-semibold text-[#244b70] hover:bg-[#f0f4f8]" href={`mailto:${shop.email}`}><span className="grid size-7 place-items-center rounded-md bg-[#e4edf6] text-[#315b82]"><Icon name="mail" size={13}/></span>{shop.email}</a>}
          {shop.telegram && <a className="flex min-h-10 items-center gap-2.5 rounded-lg border border-[#dbe3ec] px-3 text-[11px] font-semibold text-[#244b70] hover:bg-[#f0f4f8]" href={`https://t.me/${shop.telegram}`} target="_blank" rel="noreferrer"><span className="grid size-7 place-items-center rounded-md bg-[#e4edf6] text-[#315b82]"><Icon name="message" size={13}/></span>@{shop.telegram}</a>}
          <Link className="request-repair-button mt-4 flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#163f6b] text-[11px] font-semibold" to="/request-repair"><Icon name="wrench" size={13}/>Request a Repair</Link>
        </section>
        <section className="rounded-xl bg-[#fde9e8] p-4"><h2 className="m-0 flex items-center gap-2 text-[12px] font-bold"><span className="text-red-600">⚠</span> Is it urgent?</h2><p className="my-2 text-[10px] leading-4 text-[#718197]">Use Emergency Service and we’ll find the fastest available technician for you.</p><a className="inline-flex min-h-7 items-center gap-1 rounded-md bg-[#c9343b] px-3 text-[10px] font-semibold text-white" href="/emergency-service"><Icon name="phone" size={11}/>Emergency Service</a></section><Link className="text-[11px] font-semibold text-[#315b82] hover:underline" to="/repair-shops">← Back to all repair shops</Link></aside>
    </div></main><Footer/></div>;
}

function Info({ icon, title, detail }) { return <div className="mb-3 flex items-start gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#e4edf6] text-[#315b82]"><Icon name={icon} size={14}/></span><span><b className="block text-[10px]">{title}</b><small className="text-[9px] leading-4 text-[#718197]">{detail}</small></span></div>; }
function slugify(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
