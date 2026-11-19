import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import Icon from "../components/Icon.jsx";

const storageKey = "homefix-repair-requests";

const demoRequests = [
  {
    id: "HF-2026-100241",
    appliance: "Air Conditioner",
    issue: "Indoor unit is leaking water and stops cooling after 20 minutes.",
    customerName: "Sopheak Kim",
    phone: "012 345 678",
    location: "House 42, Street 271, Toul Kork",
    shop: "CoolTech AC Service",
    status: "Pending",
    emergency: true,
    date: "Nov 18, 2026",
  },
  {
    id: "HF-2026-100238",
    appliance: "Refrigerator",
    issue: "Freezer is not holding temperature. Food is beginning to spoil.",
    customerName: "Dara Sok",
    phone: "015 882 410",
    location: "Building 8, Sen Sok District",
    shop: "FrostFix Fridge Repair",
    status: "In Progress",
    emergency: false,
    date: "Nov 18, 2026",
  },
  {
    id: "HF-2026-100232",
    appliance: "Washing Machine",
    issue: "Machine will not drain and makes a loud noise during spin.",
    customerName: "Mina Pich",
    phone: "010 774 388",
    location: "Street 178, Chamkar Mon",
    shop: "SpinClean Washer Care",
    status: "Completed",
    emergency: false,
    date: "Nov 17, 2026",
  },
];

function normalizeStatus(status) {
  if (status === "Completed") return "Completed";
  if (status === "In Progress") return "In Progress";
  if (status === "Confirmed") return "In Progress";
  return "Pending";
}

export default function ShopRequestsPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedShop, setSelectedShop] = useState("All providers");
  const [requests, setRequests] = useState(() => {
    let saved = [];
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
      saved = Array.isArray(value) ? value : [];
    } catch {
      saved = [];
    }
    const customerRequests = saved.map((request) => ({
      ...request,
      customerName: request.contactName || request.customerName || "HomeFix Customer",
      phone: request.phone || "Phone not provided",
      status: normalizeStatus(request.status),
    }));
    return customerRequests.length ? [...customerRequests, ...demoRequests.filter((demo) =>
      !customerRequests.some((request) => request.id === demo.id),
    )] : demoRequests;
  });

  const visibleRequests = useMemo(() => {
    const filtered = requests.filter((request) =>
      (selectedShop === "All providers" || !selectedShop || request.shop === selectedShop) &&
      (activeFilter === "All" || normalizeStatus(request.status) === activeFilter),
    );
    return [...filtered].sort((a, b) => Number(Boolean(b.emergency)) - Number(Boolean(a.emergency)));
  }, [activeFilter, requests, selectedShop]);

  function updateStatus(id, status) {
    const updated = requests.map((request) =>
      request.id === id ? { ...request, status } : request,
    );
    setRequests(updated);
    try {
      const customerOnly = updated.filter((request) => !demoRequests.some((demo) => demo.id === request.id));
      localStorage.setItem(storageKey, JSON.stringify(customerOnly));
    } catch {
      // The status remains available for this browser session.
    }
  }

  const shops = ["All providers", ...new Set([...demoRequests.map((request) => request.shop), ...requests.map((request) => request.shop)])];

  return (
    <div className="min-h-screen bg-[#f0f4f9] text-navy">
      <Header />
      <section className="bg-white px-[18px] py-8 md:py-10">
        <div className="mx-auto max-w-[1100px]">
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[#60748d]">
            <Link to="/">Home</Link><span>›</span><span className="font-semibold text-[#102847]">Shop owner dashboard</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-bold tracking-[.12em] text-[#315b82]">FOR REPAIR PROVIDERS</p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-1px] md:text-[36px]">Assigned Repair Requests</h1>
              <p className="mb-0 mt-2 text-sm text-[#64758b]">Review customer details, appliance problems and service locations.</p>
            </div>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg border-2 border-[#315b82] px-4 text-sm font-semibold bg-[#315b82] text-white hover:bg-[#244b70]" to="/shop/services">
              <Icon name="wrench" size={15}/>Manage services
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1100px] px-[18px] py-7 md:py-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["All", "Pending", "In Progress", "Completed"].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${activeFilter === filter ? "border-[#163f6b] bg-[#163f6b] text-white" : "border-[#d6dfea] bg-white text-[#52657b] hover:bg-[#f8fafc]"}`}
              >
                {filter}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#52657b]">
            Provider
            <select className="min-h-10 rounded-lg border-2 border-[#d6dfea] bg-white px-3 text-sm font-normal outline-none" value={selectedShop} onChange={(event) => setSelectedShop(event.target.value)}>
              {shops.map((shop) => <option key={shop}>{shop}</option>)}
            </select>
          </label>
        </div>

        {visibleRequests.length ? (
          <div className="grid gap-4">
            {visibleRequests.map((request) => (
              <article className={`rounded-xl border-2 bg-white p-5 shadow-[0_3px_12px_rgba(16,40,71,.04)] md:p-6 ${request.emergency ? "border-[#e89da1] ring-1 ring-[#f2c9cb]" : "border-[#dbe3ec]"}`} key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {request.emergency && (
                      <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#cf3b42] px-2.5 py-1 text-[11px] font-bold text-white">
                        <Icon name="alert" size={12}/>Emergency · Priority
                      </span>
                    )}
                    <p className="mb-1 mt-0 text-xs font-semibold tracking-wide text-[#718197]">REQUEST {request.id}</p>
                    <h2 className="m-0 text-lg font-bold">{request.appliance}</h2>
                    <p className="mb-0 mt-1 text-sm leading-6 text-[#64758b]">{request.issue}</p>
                  </div>
                  <OwnerStatusBadge status={normalizeStatus(request.status)} />
                </div>
                <div className="mt-5 grid gap-4 border-t-2 border-[#edf0f4] pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  <OwnerInfo label="Customer" value={request.customerName} icon="user"/>
                  <OwnerInfo label="Phone" value={request.phone} icon="phone"/>
                  <OwnerInfo label="Service address" value={request.location} icon="pin"/>
                  <OwnerInfo label="Submitted" value={request.date || "Recently submitted"} icon="calendar"/>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <label className="text-xs font-semibold text-[#52657b]">
                    Update status
                    <select
                      className="ml-2 min-h-9 rounded-lg border-2 border-[#d6dfea] bg-white px-3 text-xs font-semibold outline-none"
                      value={normalizeStatus(request.status)}
                      onChange={(event) => updateStatus(request.id, event.target.value)}
                    >
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </label>
                  {request.phone && request.phone !== "Phone not provided" && (
                    <a className="inline-flex min-h-9 items-center gap-2 rounded-lg border-2 border-[#315b82] px-3 text-xs font-semibold bg-[#315b82] text-white hover:bg-[#244b70]" href={`tel:${request.phone.replace(/[\s()-]/g, "")}`}>
                      <Icon name="phone" size={13}/>Call customer
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="rounded-xl border-2 border-dashed border-[#cbd7e3] bg-white px-5 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="calendar" size={22}/></span>
            <h2 className="mb-2 mt-4 text-lg font-bold">No assigned requests</h2>
            <p className="m-0 text-sm text-[#718197]">There are no requests with this status for the selected provider.</p>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

function OwnerStatusBadge({ status }) {
  const styles =
    status === "Completed" ? "bg-[#e9f1f9] text-[#315b82]"
      : status === "In Progress" ? "bg-[#fff7e5] text-[#9b6b11]"
        : "bg-[#edf2f7] text-[#52657b]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${styles}`}>
      <span className="size-1.5 rounded-full bg-current"/>{status}
    </span>
  );
}

function OwnerInfo({ label, value, icon }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e8eef5] text-[#315b82]"><Icon name={icon} size={15}/></span>
      <span><small className="block text-xs text-[#718197]">{label}</small><b className="mt-0.5 block text-sm leading-5">{value}</b></span>
    </div>
  );
}
