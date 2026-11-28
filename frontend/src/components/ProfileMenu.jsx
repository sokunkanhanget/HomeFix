import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProfileAvatar from "./ProfileAvatar.jsx";
import { clearCustomer, logOutCustomer, saveCustomer } from "../data/customerAccount.js";
import { fetchMyProfile } from "../data/profileApi.js";

let syncedThisPageLoad = false;

// Profile icon shown in the header after login, with a small menu.
export default function ProfileMenu({ customer }) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  const navigate = useNavigate();

  // Once per page load, refresh the stored user from the server so the photo
  // is current, and fall back to "logged out" if the session has expired.
  useEffect(() => {
    if (syncedThisPageLoad) return;
    syncedThisPageLoad = true;
    fetchMyProfile()
      .then((profile) => saveCustomer(profile))
      .catch((error) => { if (error.status === 401) clearCustomer(); });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => { if (!container.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logOut() {
    setOpen(false);
    await logOutCustomer();
    navigate("/login");
  }

  const itemClass = "block w-full px-4 py-2.5 text-left text-sm text-[#102847] hover:bg-[#f0f4f9]";

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        className="flex items-center rounded-full ring-offset-2 transition hover:ring-2 hover:ring-[#285982] focus-visible:ring-2 focus-visible:ring-[#285982]"
      >
        <ProfileAvatar photoUrl={customer.photoUrl} name={customer.name} size={38} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-xl border-2 border-[#d6dfea] bg-white shadow-xl">
          <div className="flex items-center gap-3 border-b-2 border-[#eef2f7] px-4 py-3">
            <ProfileAvatar photoUrl={customer.photoUrl} name={customer.name} size={40} />
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-semibold text-[#102847]">{customer.name}</p>
              <p className="m-0 truncate text-xs text-slate-500">{customer.email}</p>
            </div>
          </div>
          <Link role="menuitem" to="/my-profile" className={itemClass} onClick={() => setOpen(false)}>My profile</Link>
          <Link role="menuitem" to="/#dashboard" className={itemClass} onClick={() => setOpen(false)}>My dashboard</Link>
          <Link role="menuitem" to="/profile" className={itemClass} onClick={() => setOpen(false)}>Edit profile</Link>
          {customer.role === "admin" && <Link role="menuitem" to="/admin/activity" className={itemClass} onClick={() => setOpen(false)}>Activity log</Link>}
          <button role="menuitem" type="button" onClick={logOut} className={`${itemClass} border-t-2 border-[#eef2f7] font-semibold text-[#c9343b]`}>Log out</button>
        </div>
      )}
    </div>
  );
}
