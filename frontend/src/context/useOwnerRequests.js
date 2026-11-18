import { useShops } from "./ShopContext.jsx";
import useRepairRequests from "./useRepairRequests.js";
import { requestsForShop } from "../data/ownerRequests.js";

export default function useOwnerRequests() {
  const { ownerShop } = useShops();
  const { requests, error, updateRequest } = useRepairRequests();
  function updateOwnerRequest(id, transform) {
    updateRequest(id, (request) => {
      if (!requestsForShop([request], ownerShop).length) throw new Error("This request belongs to another shop.");
      return transform(request);
    });
  }
  return { requests: requestsForShop(requests, ownerShop), error, updateRequest: updateOwnerRequest };
}
