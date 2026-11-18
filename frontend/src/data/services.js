import { categories, shops } from "./homepage.js";

export const serviceNames = categories.map(({ name }) => name);
export const defaultShops = shops.map((shop, index) => ({
  ...shop,
  id: ["cooltech", "frostfix", "brightview"][index],
  services: [shop.category],
}));
export const supportsService = (shop, service) => shop.services.includes(service);
export const matchShops = (directory, service) => directory.filter((shop) => supportsService(shop, service));
export function restoreServices(saved) {
  return defaultShops.map((shop) => ({
    ...shop,
    services: Array.isArray(saved?.[shop.id])
      ? serviceNames.filter((name) => saved[shop.id].includes(name))
      : shop.services,
  }));
}
