import { Link, useParams } from "react-router-dom";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import Icon from "../components/Icon.jsx";

function readRequest(requestId) {
  try {
    const requests = JSON.parse(localStorage.getItem("homefix-repair-requests") || "[]");
    return Array.isArray(requests)
      ? requests.find((request) => request.id === requestId) || null
      : null;
  } catch {
    return null;
  }
}

export default function RepairRequestDetailsPage() {
  const { requestId } = useParams();
  const request = readRequest(requestId);

  if (!request) {
    return (
      <div className="min-h-screen bg-[#f0f4f9] text-navy">
        <Header />
        <main className="mx-auto max-w-[760px] px-[18px] py-16 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="search" size={22}/></span>
          <h1 className="mb-2 mt-4 text-2xl font-bold">Request not found</h1>
          <p className="m-0 text-sm text-[#718197]">This repair request may have been removed from this browser.</p>
          <Link className="mt-5 inline-flex rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white" to="/my-repair-requests">Back to my requests</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const statusDescription = request.status === "Completed"
    ? "This repair request has been completed."
    : request.status === "Cancellation requested"
      ? "Your cancellation request is waiting for HomeFix to confirm."
      : request.emergency
        ? "Your urgent request has been received and is awaiting a response."
        : request.status === "Confirmed"
          ? "Your appointment has been confirmed by the repair shop."
          : "Your request has been received and is waiting for shop confirmation.";

  return (
    <div className="min-h-screen bg-[#f0f4f9] text-navy">
      <Header />
      <section className="bg-white px-[18px] py-8 md:py-10">
        <div className="mx-auto max-w-[1000px]">
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[#60748d]">
            <Link to="/">Home</Link><span>›</span><Link to="/my-repair-requests">My Repair Requests</Link><span>›</span><span className="font-semibold text-[#102847]">Request details</span>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {request.emergency && <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#cf3b42] px-2.5 py-1 text-[11px] font-bold text-white"><Icon name="alert" size={12}/>Emergency request</span>}
              <p className="mb-1 mt-0 text-xs font-semibold tracking-wide text-[#718197]">REQUEST {request.id}</p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-1px] md:text-[36px]">{request.appliance || "Home repair"}</h1>
              <p className="mb-0 mt-2 text-sm text-[#64758b]">Submitted {request.date || "recently"} · {request.time || "Appointment to be confirmed"}</p>
            </div>
            <StatusBadge status={request.status || "Awaiting confirmation"} />
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1000px] gap-5 px-[18px] py-7 md:grid-cols-[minmax(0,1fr)_320px] md:py-9">
        <div className="grid content-start gap-4">
          <section className="rounded-xl border border-[#dbe3ec] bg-white p-5 md:p-6">
            <h2 className="m-0 text-base font-bold">Repair details</h2>
            <p className="mb-0 mt-3 whitespace-pre-wrap text-sm leading-6 text-[#52657b]">{request.issue || "No problem description was provided."}</p>
            {request.brandModel && <p className="mb-0 mt-3 text-sm text-[#64758b]"><strong className="text-[#263e58]">Brand / model:</strong> {request.brandModel}</p>}
            {request.photoNames?.length > 0 && (
              <div className="mt-4 border-t border-[#edf0f4] pt-3">
                <h3 className="m-0 text-xs font-bold">Attached photos</h3>
                <ul className="mb-0 mt-2 grid gap-1 pl-5 text-xs text-[#52657b]">{request.photoNames.map((name) => <li key={name}>{name}</li>)}</ul>
              </div>
            )}
          </section>
          <section className="rounded-xl border border-[#dbe3ec] bg-white p-5 md:p-6">
            <h2 className="mb-4 mt-0 text-base font-bold">Appointment and service</h2>
            <DetailRow icon="store" label="Selected shop" value={request.shop || "Not assigned yet"} />
            <DetailRow icon="calendar" label="Preferred appointment" value={`${request.date || "To be confirmed"} · ${request.time || "To be confirmed"}`} />
            <DetailRow icon="home" label="Service type" value={request.serviceType || (request.emergency ? "Emergency response" : "Home visit")} />
            <DetailRow icon="pin" label="Service address" value={request.location || "Not provided"} />
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className={`rounded-xl border bg-white p-5 ${request.emergency ? "border-[#efb7ba]" : "border-[#dbe3ec]"}`}>
            <h2 className="mb-2 mt-0 text-sm font-bold">Request status</h2>
            <StatusBadge status={request.status || "Awaiting confirmation"} />
            <p className="mb-0 mt-3 text-xs leading-5 text-[#64758b]">{statusDescription}</p>
            {request.cancellationReason && <p className="mb-0 mt-3 text-xs leading-5 text-[#64758b]"><strong>Cancellation reason:</strong> {request.cancellationReason}{request.cancellationDetails ? ` — ${request.cancellationDetails}` : ""}</p>}
            {request.updatedAt && <p className="mb-0 mt-3 text-[11px] text-[#718197]">Last updated {request.updatedAt}</p>}
          </section>
          {request.contactName || request.phone ? (
            <section className="rounded-xl border border-[#dbe3ec] bg-white p-5">
              <h2 className="mb-3 mt-0 text-sm font-bold">Contact details</h2>
              {request.contactName && <DetailRow icon="user" label="Name" value={request.contactName} />}
              {request.phone && <a className="flex items-center gap-2.5 py-2 text-xs font-semibold text-[#315b82] hover:underline" href={`tel:${request.phone.replace(/[\s()-]/g, "")}`}><Icon name="phone" size={15}/>{request.phone}</a>}
            </section>
          ) : null}
          <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#315b82] bg-white px-4 text-sm font-semibold text-[#315b82] hover:bg-[#f8fafc]" to="/my-repair-requests">
            <Icon name="arrow" size={14}/>Back to my requests
          </Link>
          {request.shop && <Link className="text-center text-xs font-semibold text-[#315b82] hover:underline" to={`/repair-shops/${request.shop.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}>View selected shop</Link>}
        </aside>
      </main>
      <Footer />
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-[#edf0f4] py-3 first:border-0 first:pt-0 last:pb-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e8eef5] text-[#315b82]"><Icon name={icon} size={15}/></span>
      <span><small className="block text-xs text-[#718197]">{label}</small><b className="mt-0.5 block text-sm leading-5">{value}</b></span>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = status?.startsWith("Emergency")
    ? "bg-[#fde7e5] text-[#b52d34]"
    : status === "Completed"
      ? "bg-[#e9f1f9] text-[#315b82]"
      : status === "Cancellation requested"
        ? "bg-[#fff2e2] text-[#a45a12]"
        : status === "Confirmed"
          ? "bg-[#e8f6ee] text-[#258a62]"
          : "bg-[#fff7e5] text-[#9b6b11]";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${styles}`}><span className="size-1.5 rounded-full bg-current"/>{status}</span>;
}
