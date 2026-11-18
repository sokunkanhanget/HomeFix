import { useState } from "react";
import { Link } from "react-router-dom";
import ShopCard from "../components/ShopCard.jsx";
import ShopDetailsDialog from "../components/ShopDetailsDialog.jsx";
import { useShops } from "../context/ShopContext.jsx";
import { serviceNames } from "../data/services.js";
import check from "../assets/figma/service-check.svg";

export default function ShopServicesPage() {
  const { directory, saveServices } = useShops();
  const [shopId, setShopId] = useState("cooltech");
  const shop = directory.find((item) => item.id === shopId);
  return <>
    <header className="bg-pale px-[18px] py-12"><div className="mx-auto max-w-[1200px]"><p className="text-xs font-bold tracking-widest text-[#315b82]">FOR REPAIR PROVIDERS</p><h1 className="mt-3 text-3xl font-bold md:text-[40px]">Supported service categories</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#5a6b82]">Choose the appliances and services your shop repairs so customers can find the right help.</p></div></header>
    <main className="mx-auto grid max-w-[1200px] gap-8 px-[18px] py-12 lg:grid-cols-[minmax(0,784px)_minmax(0,384px)]">
      <div><label className="mb-6 block text-sm font-semibold">Preview provider account<select className="mt-2 block w-full rounded-lg border border-[#d6dfea] bg-white p-3" value={shopId} onChange={(event) => setShopId(event.target.value)}>{directory.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="mb-5 text-xs text-[#6a7b91]">Frontend demo: changes are saved in this browser. Provider sign-in and server storage will be connected later.</p><ServiceForm key={shop.id} shop={shop} saveServices={saveServices} /></div>
      <aside><h2 className="mb-4 text-lg font-bold">Public listing preview</h2><Listing shop={shop} /><Link to="/#shops" className="mt-5 inline-block text-sm font-semibold text-[#123b66] underline">View public directory</Link></aside>
    </main></>;
}
function Listing({ shop }) {
  const [open, setOpen] = useState(false);
  return <><ShopCard shop={shop} onDetails={() => setOpen(true)} />{open && <ShopDetailsDialog shop={shop} onClose={() => setOpen(false)} />}</>;
}
function ServiceForm({ shop, saveServices }) {
  const [selected, setSelected] = useState(shop.services);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = selected.length !== shop.services.length || selected.some((name) => !shop.services.includes(name));
  function submit(event) {
    event.preventDefault();
    try { saveServices(shop.id, selected); setMessage("Service categories saved. Your public listing and request matches are updated."); setError(""); }
    catch { setError("Your changes could not be saved. Check browser storage settings and try again."); }
  }
  return <form onSubmit={submit} className="rounded-2xl border border-[#d6dfea] p-6 md:p-9">
    <h2 className="text-lg font-bold">What do you repair?</h2><p className="mb-7 mt-2 text-sm leading-6 text-[#6a7b91]">Select all services your shop supports. You will only be matched with requests in your saved categories.</p>
    <fieldset><legend className="sr-only">Supported service categories</legend><div className="grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-2">{serviceNames.map((name) => <label key={name} className="flex cursor-pointer items-center gap-[10px] text-sm leading-[21px] text-[#0b1f3a]"><input type="checkbox" className="peer sr-only" checked={selected.includes(name)} onChange={() => { setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]); setMessage(""); setError(""); }} /><span className="grid size-5 shrink-0 place-items-center rounded-[6px] border-[1.5px] border-[#d6dfea] peer-checked:border-[#123b66] peer-checked:bg-[#123b66] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#315b82]">{selected.includes(name) && <img src={check} alt="" />}</span>{name}</label>)}</div></fieldset>
    <p className="mt-7 text-xs text-[#6a7b91]">{selected.length} {selected.length === 1 ? "category" : "categories"} selected{!selected.length && " · Your shop will not match any repair requests."}</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-lg bg-[#e3f4ec] p-3 text-sm text-[#226b50]">{message}</p>}
    <div className="mt-6 flex flex-wrap items-center justify-end gap-4 border-t border-[#d6dfea] pt-6"><button type="button" className="text-sm font-semibold text-[#315b82] disabled:opacity-50" disabled={!dirty} onClick={() => { setSelected(shop.services); setError(""); setMessage(""); }}>Discard changes</button><button type="submit" className="rounded-lg bg-[#123b66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0c2e53]">Save service categories</button></div>
  </form>;
}
