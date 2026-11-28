import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Icon from "../components/Icon.jsx";
import useCustomer from "../context/useCustomer.js";
import { clearCustomer, logOutCustomer, saveCustomer } from "../data/customerAccount.js";
import { fetchMyProfile, removeMyPhoto, updateMyProfile, uploadMyPhoto } from "../data/profileApi.js";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const inputClass = "mt-2 w-full rounded-lg border-2 px-3 py-3 text-sm font-normal outline-none focus:border-[#315b82]";

export default function CustomerProfilePage() {
  const customer = useCustomer();
  const navigate = useNavigate();
  const photoInput = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | signed-out | error
  const [message, setMessage] = useState({ type: "", text: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchMyProfile(controller.signal)
      .then((data) => { setProfile(data); setLoadState("ready"); })
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (error.status === 401) { clearCustomer(); setLoadState("signed-out"); return; }
        setLoadState("error");
        setMessage({ type: "error", text: error.message });
      });
    return () => controller.abort();
  }, []);

  function applyProfile(data, text) {
    setProfile(data);
    saveCustomer({ ...customer, ...data });
    setMessage({ type: "success", text });
  }

  function handleError(error) {
    if (error.status === 401) { clearCustomer(); setLoadState("signed-out"); return; }
    setFieldErrors(error.errors || {});
    setMessage({ type: "error", text: error.message });
  }

  async function submit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const errors = {};
    if (!name) errors.name = "Name is required.";
    if (!phone) errors.phone = "Phone number is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) { setMessage({ type: "error", text: "Please fix the highlighted fields." }); return; }

    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const result = await updateMyProfile({ name, phone });
      applyProfile(result.data, result.message);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function choosePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFieldErrors({ photo: "The photo must be a JPG, PNG or WebP image." });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) { setFieldErrors({ photo: "The photo must be 2 MB or smaller." }); return; }

    setPhotoBusy(true);
    setFieldErrors({});
    try {
      const result = await uploadMyPhoto(file);
      applyProfile(result.data, result.message);
    } catch (error) {
      handleError(error);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function deletePhoto() {
    setPhotoBusy(true);
    try {
      const result = await removeMyPhoto();
      applyProfile(result.data, result.message);
    } catch (error) {
      handleError(error);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function logOut() {
    await logOutCustomer();
    navigate("/login");
  }

  const borderFor = (field) => (fieldErrors[field] ? "border-red-400" : "border-[#d6dfea]");
  const errorFor = (field) => fieldErrors[field] && <span className="mt-1 block text-xs font-normal text-red-700">{fieldErrors[field]}</span>;

  return <div className="min-h-screen bg-[#f0f4f9] text-[#102847]"><Header />
    <section className="bg-white px-[18px] py-8 md:py-10"><div className="mx-auto max-w-[720px]">
      <h1 className="m-0 text-[30px] font-bold tracking-[-1px] md:text-[36px]">Profile settings</h1>
      <p className="mb-0 mt-2 text-sm text-[#64758b]">View and update your account details.</p>
    </div></section>

    <main className="mx-auto max-w-[720px] px-[18px] py-7 md:py-9">
      {loadState === "loading" && <p className="rounded-2xl border-2 border-[#d6dfea] bg-white p-7 text-sm text-[#64758b]">Loading your profile…</p>}

      {loadState === "error" && <p role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-800">{message.text || "Your profile could not be loaded."}</p>}

      {loadState === "ready" && profile && <form key={profile.updatedAt} onSubmit={submit} noValidate className="rounded-2xl border-2 border-[#d6dfea] bg-white p-5 md:p-7">
        {message.text && <p role={message.type === "error" ? "alert" : "status"} className={`mb-5 rounded-lg p-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-800" : "bg-[#effaf3] text-[#216746]"}`}>{message.text}</p>}

        <div className="mb-6 flex flex-wrap items-center gap-4">
          {profile.photoUrl
            ? <img src={profile.photoUrl} alt="Your profile photo" className="size-20 rounded-full border-2 border-[#d6dfea] object-cover" />
            : <span className="grid size-20 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="user" size={32} /></span>}
          <div>
            <p className="m-0 text-sm font-semibold">Profile photo</p>
            <p className="m-0 mt-1 text-xs text-slate-500">JPG, PNG or WebP, up to 2 MB.</p>
            <div className="mt-2 flex gap-2">
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="hidden" />
              <button type="button" disabled={photoBusy} onClick={() => photoInput.current?.click()} className="rounded-lg border-2 border-[#163f6b] px-3 py-1.5 text-xs font-semibold text-[#163f6b] hover:bg-[#e7eef6] disabled:opacity-50">{photoBusy ? "Saving…" : profile.photoUrl ? "Change photo" : "Upload photo"}</button>
              {profile.photoUrl && <button type="button" disabled={photoBusy} onClick={deletePhoto} className="rounded-lg border-2 border-[#d6dfea] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Remove</button>}
            </div>
            {errorFor("photo")}
          </div>
        </div>

        <label className="block text-sm font-semibold">Full name<input name="name" required maxLength={120} defaultValue={profile.name} aria-invalid={Boolean(fieldErrors.name)} className={`${inputClass} ${borderFor("name")}`} />{errorFor("name")}</label>
        <label className="mt-4 block text-sm font-semibold">Email address<input value={profile.email || ""} readOnly disabled className="mt-2 w-full rounded-lg border-2 border-[#d6dfea] bg-[#f8fafc] px-3 py-3 text-sm font-normal text-slate-500" /><span className="mt-1 block text-xs font-normal text-slate-500">Your email is used to log in and can't be changed here.</span></label>
        <label className="mt-4 block text-sm font-semibold">Phone number<input name="phone" type="tel" required maxLength={40} defaultValue={profile.phone || ""} aria-invalid={Boolean(fieldErrors.phone)} className={`${inputClass} ${borderFor("phone")}`} />{errorFor("phone")}</label>
        <label className="mt-4 block text-sm font-semibold">Account type<input value={profile.role} readOnly disabled className="mt-2 w-full rounded-lg border-2 border-[#d6dfea] bg-[#f8fafc] px-3 py-3 text-sm font-normal capitalize text-slate-500" /></label>

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <button type="button" onClick={logOut} className="rounded-lg border-2 border-[#c9343b] px-4 py-2.5 text-sm font-semibold bg-[#c9343b] text-white hover:bg-[#ad252c]">Log out</button>
          <div className="flex gap-2"><Link to="/my-profile" className="rounded-lg border-2 border-[#52657b] px-4 py-2.5 text-sm font-semibold bg-[#52657b] text-white hover:bg-[#3f5065]">Back to my profile</Link><button type="submit" disabled={saving} className="rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2e53] disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button></div>
        </div>
      </form>}

      {loadState === "signed-out" && <section className="rounded-2xl border-2 border-dashed border-[#cbd7e3] bg-white px-5 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7eef6] text-[#315b82]"><Icon name="user" size={22} /></span><h2 className="mb-2 mt-4 text-lg font-bold">You're not logged in</h2><p className="m-0 text-sm text-[#718197]">Log in to view and update your profile.</p><Link to="/login" className="mt-4 inline-flex rounded-lg bg-[#163f6b] px-4 py-2.5 text-sm font-semibold text-white">Log in</Link></section>}
    </main>
    <Footer />
  </div>;
}
