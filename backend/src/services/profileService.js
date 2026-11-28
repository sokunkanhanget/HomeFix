import * as users from "../models/userModel.js";
import { AppError } from "../utils/AppError.js";

export const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;
const EDITABLE_FIELDS = new Set(["name", "phone"]);

function toProfile(row) {
  const photoVersion = row.photo_updated_at ? new Date(row.photo_updated_at).getTime() : null;
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    role: row.role,
    photoUrl: photoVersion ? `/api/users/me/photo?v=${photoVersion}` : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

// Validates a profile update. Only name and phone may be changed; any other
// field (role, email, id, password...) is rejected rather than ignored so the
// client gets a clear answer.
export function validateProfileUpdate(body) {
  const errors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw AppError.badRequest("Validation failed.", { body: "Send the profile as a JSON object." });
  }

  for (const key of Object.keys(body)) {
    if (!EDITABLE_FIELDS.has(key)) {
      errors[key] = key === "role"
        ? "Your role cannot be changed through your profile."
        : "This field cannot be updated here.";
    }
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (body.name !== undefined && typeof body.name !== "string") errors.name = "Name must be text.";
  else if (!name) errors.name = "Name is required.";
  else if (name.length < 2) errors.name = "Name must be at least 2 characters.";
  else if (name.length > 120) errors.name = "Name must be 120 characters or fewer.";

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (body.phone !== undefined && typeof body.phone !== "string") errors.phone = "Phone number must be text.";
  else if (!phone) errors.phone = "Phone number is required.";
  else if (phone.length > 40 || !/^\+?[0-9\s()-]+$/.test(phone)) {
    errors.phone = "Enter a valid phone number using digits, spaces, +, - or ().";
  } else {
    const digits = phone.replace(/\D/g, "").length;
    if (digits < 8 || digits > 15) errors.phone = "Phone number must contain 8 to 15 digits.";
  }

  if (Object.keys(errors).length) throw AppError.badRequest("Validation failed.", errors);
  return { name, phone };
}

export async function getOwnProfile(userId, database) {
  const row = await users.findProfileById(userId, database);
  if (!row) throw AppError.notFound("Your account could not be found.");
  return toProfile(row);
}

// A user's profile is private: only its owner can read it.
export async function getProfileForViewer(viewerId, requestedId, database) {
  if (String(viewerId) !== String(requestedId)) {
    throw AppError.forbidden("You can only view your own profile.");
  }
  return getOwnProfile(viewerId, database);
}

export async function updateOwnProfile(userId, body, database) {
  const values = validateProfileUpdate(body);
  const updated = await users.updateProfileDetails(userId, values, database);
  if (!updated) throw AppError.notFound("Your account could not be found.");
  return getOwnProfile(userId, database);
}

// Detects the real image type from the file's first bytes, so a renamed file
// cannot pretend to be an image.
export function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export async function updateOwnPhoto(userId, file, database) {
  if (!file?.buffer?.length) {
    throw AppError.badRequest("Validation failed.", { photo: "Choose a JPG, PNG or WebP image to upload." });
  }
  const contentType = detectImageType(file.buffer);
  if (!contentType) {
    throw AppError.badRequest("Validation failed.", { photo: "The photo must be a JPG, PNG or WebP image." });
  }
  await users.saveProfilePhoto(userId, { contentType, data: file.buffer }, database);
  return getOwnProfile(userId, database);
}

export async function getOwnPhoto(userId, database) {
  const photo = await users.findProfilePhoto(userId, database);
  if (!photo) throw AppError.notFound("You have not uploaded a profile photo.");
  return photo;
}

export async function removeOwnPhoto(userId, database) {
  await users.deleteProfilePhoto(userId, database);
  return getOwnProfile(userId, database);
}
