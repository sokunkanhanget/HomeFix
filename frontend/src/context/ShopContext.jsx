import { createContext, useContext, useEffect, useState } from "react";
import { defaultShops, restoreServices, serviceNames } from "../data/services.js";
import { repairShops } from "../data/repairShops.js";

const storageKey = "homefix.shop-services.v1";
const profileStorageKey = "homefix.shop-profiles.v1";
const ShopContext = createContext(null);
function readDirectory() {
  try { return restoreServices(JSON.parse(localStorage.getItem(storageKey))); }
  catch { return defaultShops; }
}
function readProfiles() {
  try { return { ...Object.fromEntries(repairShops.map((shop) => [shop.id, shop])), ...JSON.parse(localStorage.getItem(profileStorageKey) || "{}") }; }
  catch { return Object.fromEntries(repairShops.map((shop) => [shop.id, shop])); }
}
const publicShopId = { cooltech: "cooltech-ac-service", frostfix: "frostfix-fridge-repair", brightview: "brightview-electronics" };
export function ShopProvider({ children }) {
  const [directory, setDirectory] = useState(readDirectory);
  const [profiles, setProfiles] = useState(readProfiles);
  const [ownerShopId, setOwnerShopId] = useState("cooltech");
  const selectedShop = directory.find((shop) => shop.id === ownerShopId) || directory[0];
  const profile = profiles[publicShopId[selectedShop.id]] || {};
  const ownerShop = { ...profile, ...selectedShop, id: selectedShop.id, name: profile.name, location: profile.location, phone: profile.phone, description: profile.description, profile: profile.profile, email: profile.email };
  useEffect(() => {
    function sync(event) {
      if (event.key === storageKey || event.key === null) setDirectory(readDirectory());
      if (event.key === profileStorageKey || event.key === null) setProfiles(readProfiles());
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
  return <ShopContext.Provider value={{ directory, publicShops: repairShops.map((shop) => profiles[shop.id] || shop), saveServices, saveShopProfile, ownerShop, setOwnerShopId }}>{children}</ShopContext.Provider>;
}
export const useShops = () => useContext(ShopContext);
