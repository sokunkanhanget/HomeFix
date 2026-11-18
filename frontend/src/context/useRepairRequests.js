import { useEffect, useState } from "react";
import { parseRequests, requestStorageKey, requestsChangedEvent, saveRequests } from "../data/ownerRequests.js";

export default function useRepairRequests() {
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
    window.addEventListener(requestsChangedEvent, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(requestsChangedEvent, refresh);
    };
  }, []);
  function updateRequest(id, transform) {
    // Read fresh data so actions never overwrite changes from another page or tab.
    const latest = parseRequests(localStorage.getItem(requestStorageKey));
    if (!latest.some((request) => request.id === id)) throw new Error("This request is no longer available. Refresh and try again.");
    const next = latest.map((request) => request.id === id ? transform(request) : request);
    saveRequests(next);
    setRequests(next);
  }
  return { requests, error, updateRequest };
}
