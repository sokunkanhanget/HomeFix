import { createContext, useContext, useEffect, useState } from "react";
import { defaultShops, restoreServices, serviceNames } from "../data/services.js";

const storageKey = "homefix.shop-services.v1";
const ShopContext = createContext(null);
function readDirectory() {
  try { return restoreServices(JSON.parse(localStorage.getItem(storageKey))); }
  catch { return defaultShops; }
}
export function ShopProvider({ children }) {
  const [directory, setDirectory] = useState(readDirectory);
  useEffect(() => {
    function sync(event) { if (event.key === storageKey || event.key === null) setDirectory(readDirectory()); }
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
  return <ShopContext.Provider value={{ directory, saveServices }}>{children}</ShopContext.Provider>;
}
export const useShops = () => useContext(ShopContext);
