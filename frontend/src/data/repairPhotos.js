export const MAX_REPAIR_PHOTOS = 5;
export const MAX_REPAIR_PHOTO_SIZE = 5 * 1024 * 1024;
export const REPAIR_PHOTO_ACCEPT = "image/png,image/jpeg";

export function validateRepairPhotos(files, currentCount = 0) {
  const selected = Array.from(files || []);
  if (currentCount + selected.length > MAX_REPAIR_PHOTOS) {
    return `You can attach up to ${MAX_REPAIR_PHOTOS} photos to a repair request.`;
  }
  if (selected.some((file) => !["image/png", "image/jpeg"].includes(file.type))) {
    return "Only PNG and JPG photos are supported.";
  }
  if (selected.some((file) => file.size > MAX_REPAIR_PHOTO_SIZE)) {
    return "Each photo must be 5 MB or smaller.";
  }
  return "";
}
