import { useEffect, useState } from "react";
import { useShops } from "./ShopContext.jsx";
import { parseRequests, requestsForShop, requestStorageKey } from "../data/ownerRequests.js";

export default function useOwnerRequests() {
  const { ownerShop } = useShops();
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    function refresh() {
      try {
        setRequests(parseRequests(localStorage.getItem(requestStorageKey)));
        setError("");
      } catch { setError("Repair requests could not be loaded. Allow browser storage and refresh this page."); }
    }
    function onStorage(event) { if (event.key === requestStorageKey || event.key === null) refresh(); }
    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return { requests: requestsForShop(requests, ownerShop), error };
}
