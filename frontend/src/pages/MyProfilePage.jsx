import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Icon from "../components/Icon.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { clearCustomer, logOutCustomer, saveCustomer } from "../data/customerAccount.js";
import { fetchMyProfile } from "../data/profileApi.js";

function formatDate(value) {
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "Not recorded";
}

const roleLabels = { customer: "Customer", owner: "Repair shop owner", admin: "Administrator" };

function DetailRow({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 border-b-2 border-[#eef2f7] py-4 last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e7eef6] text-[#315b82]"><Icon name={icon} size={17} /></span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="m-0 mt-1 break-words text-[15px] text-[#102847]">{children}</dd>
      </div>
    </div>
  );
}

// Read-only view of the logged-in user's profile.
export default function MyProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | signed-out | error
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchMyProfile(controller.signal)
      .then((data) => { setProfile(data); saveCustomer(data); setState("ready"); })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        if (requestError.status === 401) { clearCustomer(); setState("signed-out"); return; }
        setError(requestError.message);
        setState("error");
      });
    return () => controller.abort();
  }, []);

  async function logOut() {
    await logOutCustomer();
    navigate("/login");
  }

  return <div className="min-h-screen bg-[#f0f4f9] text-[#102847]"><Header />
    <section className="bg-white px-[18px] py-8 md:py-10"><div className="mx-auto max-w-[720px]">
      <h1 className="m-0 text-[30px] font-bold tracking-[-1px] md:text-[36px]">My profile</h1>
      <p className="mb-0 mt-2 text-sm text-[#64758b]">Your account details on HomeFix.</p>
    </div></section>

    <main className="mx-auto max-w-[720px] px-[18px] py-7 md:py-9">
      {state === "loading" && <p className="rounded-2xl border-2 border-[#d6dfea] bg-white p-7 text-sm text-[#64758b]">Loading your profile…</p>}

      {state === "error" && <p role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-800">{error || "Your profile could not be loaded."}</p>}

      {state === "ready" && profile && <article className="overflow-hidden rounded-2xl border-2 border-[#d6dfea] bg-white">
        <div className="flex flex-col items-center gap-3 bg-[#f8fafc] px-5 py-8 text-center sm:flex-row sm:text-left">
          <ProfileAvatar photoUrl={profile.photoUrl} name={profile.name} size={96} />
          <div className="sm:ml-2">
            <h2 className="m-0 text-2xl font-bold">{profile.name}</h2>
            <span className="mt-2 inline-flex rounded-full bg-[#e7eef6] px-3 py-1 text-xs font-semibold text-[#315b82]">{roleLabels[profile.role] || profile.role}</span>
          </div>
        </div>

        <dl className="m-0 px-5 md:px-7">
          <DetailRow icon="user" label="Full name">{profile.name}</DetailRow>
          <DetailRow icon="mail" label="Email address">{profile.email}</DetailRow>
          <DetailRow icon="phone" label="Phone number">{profile.phone || <span className="text-slate-400">Not added yet</span>}</DetailRow>
          <DetailRow icon="calendar" label="Member since">{formatDate(profile.createdAt)}</DetailRow>
          <DetailRow icon="clock" label="Last updated">{formatDate(profile.updatedAt)}</DetailRow>
        </dl>

        <div className="flex flex-wrap justify-between gap-3 border-t-2 border-[#eef2f7] px-5 py-5 md:px-7">
          <button type="button" onClick={logOut} className="rounded-lg border-2 border-[#c9343b] px-4 py-2.5 text-sm font-semibold text-[#c9343b] hover:bg-red-50">Log out</button>
          <div className="flex gap-2">
            <Link to="/#dashboard" className="rounded-lg border-2 border-[#52657b] px-4 py-2.5 text-sm font-semibold text-[#52657b] hover:bg-slate-50">My dashboard</Link>
            <Link to="/profile" className="rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2e53]">Edit profile</Link>
          </div>
        </div>
      </article>}

      {state === "signed-out" && <section className="rounded-2xl border-2 border-dashed border-[#cbd7e3] bg-white px-5 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="user" size={22} /></span><h2 className="mb-2 mt-4 text-lg font-bold">You're not logged in</h2><p className="m-0 text-sm text-[#718197]">Log in to see your profile.</p><Link to="/login" className="mt-4 inline-flex rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white">Log in</Link></section>}
    </main>
    <Footer />
  </div>;
}
