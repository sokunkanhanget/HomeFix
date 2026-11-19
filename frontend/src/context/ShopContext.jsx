import { createContext, useContext, useEffect, useState } from "react";
import { defaultShops, restoreServices, serviceNames } from "../data/services.js";
import { repairShops } from "../data/repairShops.js";

const storageKey = "homefix.shop-services.v1";
const profileStorageKey = "homefix.shop-profiles.v1";
const registrationStorageKey = "homefix.shop-registrations.v1";
const ShopContext = createContext(null);
function readDirectory() {
  try { return restoreServices(JSON.parse(localStorage.getItem(storageKey))); }
  catch { return defaultShops; }
}
function readProfiles() {
  try { return { ...Object.fromEntries(repairShops.map((shop) => [shop.id, shop])), ...JSON.parse(localStorage.getItem(profileStorageKey) || "{}") }; }
  catch { return Object.fromEntries(repairShops.map((shop) => [shop.id, shop])); }
}
function readRegistrations() {
  try {
    const value = JSON.parse(localStorage.getItem(registrationStorageKey) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string") : [];
  } catch { return []; }
}
const publicShopId = { cooltech: "cooltech-ac-service", frostfix: "frostfix-fridge-repair", brightview: "brightview-electronics" };
export function ShopProvider({ children }) {
  const [directory, setDirectory] = useState(readDirectory);
  const [profiles, setProfiles] = useState(readProfiles);
  const [registrations, setRegistrations] = useState(readRegistrations);
  const [ownerShopId, setOwnerShopId] = useState("cooltech");
  const selectedShop = directory.find((shop) => shop.id === ownerShopId) || directory[0];
  const profile = profiles[publicShopId[selectedShop.id]] || {};
  const ownerShop = { ...profile, ...selectedShop, id: selectedShop.id, name: profile.name, location: profile.location, phone: profile.phone, description: profile.description, profile: profile.profile, email: profile.email };
  useEffect(() => {
    function sync(event) {
      if (event.key === storageKey || event.key === null) setDirectory(readDirectory());
      if (event.key === profileStorageKey || event.key === null) setProfiles(readProfiles());
      if (event.key === registrationStorageKey || event.key === null) setRegistrations(readRegistrations());
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function saveServices(shopId, selected) {
    const services = serviceNames.filter((name) => selected.includes(name));
    const next = directory.map((shop) => shop.id === shopId ? { ...shop, services } : shop);
    // Persist first: a storage failure must never display a successful save.
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(next.map((shop) => [shop.id, shop.services]))));
    setDirectory(next);
  }
  function saveShopProfile(shopId, changes) {
    const publicId = publicShopId[shopId];
    const shop = profiles[publicId];
    const next = { ...profiles, [publicId]: { ...shop, ...changes } };
    localStorage.setItem(profileStorageKey, JSON.stringify(Object.fromEntries(Object.entries(next).filter(([id]) => id !== "undefined"))));
    setProfiles(next);
  }
  function submitShopRegistration(details) {
    const registration = {
      ...details,
      id: `registration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      submittedAt: new Date().toISOString(),
      rating: 0,
      reviews: 0,
      services: [details.category],
      profile: { address: details.address, operatingHours: details.operatingHours },
    };
    const next = [registration, ...registrations];
    localStorage.setItem(registrationStorageKey, JSON.stringify(next));
    setRegistrations(next);
  }
  function reviewShopRegistration(registrationId, status) {
    if (!["approved", "rejected"].includes(status)) throw new Error("Choose approve or reject.");
    if (!registrations.some((registration) => registration.id === registrationId && registration.status === "pending")) {
      throw new Error("This registration is no longer pending.");
    }
    const next = registrations.map((registration) => registration.id === registrationId && registration.status === "pending"
      ? { ...registration, status, reviewedAt: new Date().toISOString() }
      : registration);
    localStorage.setItem(registrationStorageKey, JSON.stringify(next));
    setRegistrations(next);
  }
  const publicShops = [
    ...repairShops.map((shop) => profiles[shop.id] || shop),
    ...registrations.filter((registration) => registration.status === "approved"),
  ];
  return <ShopContext.Provider value={{ directory, publicShops, registrations, submitShopRegistration, reviewShopRegistration, saveServices, saveShopProfile, ownerShop, setOwnerShopId }}>{children}</ShopContext.Provider>;
}
export const useShops = () => useContext(ShopContext);
