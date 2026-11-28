import useRepairRequests from "./useRepairRequests.js";

// The API limits results and mutations to the authenticated owner's assigned shop.
export default function useOwnerRequests() {
  return useRepairRequests();
}
