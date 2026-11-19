import { useEffect, useState } from "react";
import { customerChangedEvent, customerStorageKey, loadCustomer } from "../data/customerAccount.js";

export default function useCustomer() {
  const [customer, setCustomer] = useState(loadCustomer);
  useEffect(() => {
    const refresh = () => setCustomer(loadCustomer());
    const onStorage = (event) => { if (event.key === customerStorageKey || event.key === null) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(customerChangedEvent, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(customerChangedEvent, refresh);
    };
  }, []);
  return customer;
}
