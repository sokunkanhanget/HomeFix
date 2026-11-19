import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Icon from "../components/Icon.jsx";
import useCustomer from "../context/useCustomer.js";
import { clearCustomer, saveCustomer } from "../data/customerAccount.js";

export default function CustomerProfilePage() {
  const customer = useCustomer();
  const navigate = useNavigate();
  const [message, setMessage] = useState({ type: "", text: "" });

  function submit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    if (!name) { setMessage({ type: "error", text: "Please enter your name." }); return; }
    try {
      saveCustomer({ ...customer, name, phone });
      setMessage({ type: "success", text: "Your profile has been updated." });
    } catch { setMessage({ type: "error", text: "Your profile could not be saved. Allow browser storage and try again." }); }
  }

  function logOut() {
    clearCustomer();
    navigate("/login");
  }

  return <div className="min-h-screen bg-[#f0f4f9] text-[#102847]"><Header />
    <section className="bg-white px-[18px] py-8 md:py-10"><div className="mx-auto max-w-[720px]">
      <h1 className="m-0 text-[30px] font-bold tracking-[-1px] md:text-[36px]">Profile settings</h1>
      <p className="mb-0 mt-2 text-sm text-[#64758b]">View and update your account details.</p>
    </div></section>

    <main className="mx-auto max-w-[720px] px-[18px] py-7 md:py-9">
      {customer ? <form key={`${customer.name}|${customer.phone}`} onSubmit={submit} className="rounded-2xl border-2 border-[#d6dfea] bg-white p-5 md:p-7">
        {message.text && <p role={message.type === "error" ? "alert" : "status"} className={`mb-5 rounded-lg p-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-800" : "bg-[#effaf3] text-[#216746]"}`}>{message.text}</p>}
        <label className="block text-sm font-semibold">Full name<input name="name" required maxLength={120} defaultValue={customer.name} className="mt-2 w-full rounded-lg border-2 border-[#d6dfea] px-3 py-3 text-sm font-normal outline-none focus:border-[#315b82]" /></label>
        <label className="mt-4 block text-sm font-semibold">Email address<input value={customer.email || ""} readOnly disabled className="mt-2 w-full rounded-lg border-2 border-[#d6dfea] bg-[#f8fafc] px-3 py-3 text-sm font-normal text-slate-500" /><span className="mt-1 block text-xs font-normal text-slate-500">Your email is used to log in and can't be changed here.</span></label>
        <label className="mt-4 block text-sm font-semibold">Phone number<input name="phone" type="tel" maxLength={40} defaultValue={customer.phone || ""} className="mt-2 w-full rounded-lg border-2 border-[#d6dfea] px-3 py-3 text-sm font-normal outline-none focus:border-[#315b82]" /></label>
        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <button type="button" onClick={logOut} className="rounded-lg border-2 border-[#c9343b] px-4 py-2.5 text-sm font-semibold bg-[#c9343b] text-white hover:bg-[#ad252c]">Log out</button>
          <div className="flex gap-2"><Link to="/#dashboard" className="rounded-lg border-2 border-[#52657b] px-4 py-2.5 text-sm font-semibold bg-[#52657b] text-white hover:bg-[#3f5065]">Back to dashboard</Link><button type="submit" className="rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2e53]">Save changes</button></div>
        </div>
      </form>
        : <section className="rounded-2xl border-2 border-dashed border-[#cbd7e3] bg-white px-5 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="user" size={22} /></span><h2 className="mb-2 mt-4 text-lg font-bold">You're not logged in</h2><p className="m-0 text-sm text-[#718197]">Log in to view and update your profile.</p><Link to="/login" className="mt-4 inline-flex rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white">Log in</Link></section>}
    </main>
    <Footer />
  </div>;
}
