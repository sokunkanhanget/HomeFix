import { useCallback, useEffect, useRef, useState } from "react";
import { customerChangedEvent } from "../data/customerAccount.js";
import { requestsChangedEvent } from "../data/ownerRequests.js";
import { loadRepairRequests, updateRepairStatus } from "../data/repairRequestApi.js";

export default function useRepairRequests() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    try {
      const next = await loadRepairRequests();
      if (version !== generation.current) return;
      setRequests(next);
      setError("");
    } catch (err) {
      if (version !== generation.current) return;
      setError(err.message || "Could not connect to the server.");
      setRequests([]);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15000);
    const onAccountChange = () => { setRequests([]); setLoading(true); refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener(requestsChangedEvent, refresh);
    window.addEventListener(customerChangedEvent, onAccountChange);
    return () => {
      generation.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(requestsChangedEvent, refresh);
      window.removeEventListener(customerChangedEvent, onAccountChange);
    };
  }, [refresh]);
  async function changeStatus(id, status, rejectionReason = "", cancellation = {}) {
    try {
      await updateRepairStatus(id, status, rejectionReason, cancellation);
      await refresh();
      window.dispatchEvent(new Event(requestsChangedEvent));
    } catch (err) {
      await refresh();
      throw err;
    }
  }
  function updateRequest(id, transform) {
    const current = requests.find((request) => request.id === id);
    if (!current) throw new Error("Repair request not found.");
    const updated = transform(current);
    if (updated.status !== current.status) throw new Error("Booking status must be saved through the server.");
    setRequests((items) => items.map((request) => request.id === id ? updated : request));
  }
  return { requests, error, loading, updateRequest, changeStatus, refresh };
}
