import * as profiles from "../services/profileService.js";

// HTTP layer for user profiles. The user's ID always comes from the verified
// session (request.user), never from the request body.
export function createProfileController(database) {
  return {
    async getMe(request, response) {
      response.json({ data: await profiles.getOwnProfile(request.user.id, database) });
    },

    async getById(request, response) {
      response.json({ data: await profiles.getProfileForViewer(request.user.id, request.params.userId, database) });
    },

    async updateMe(request, response) {
      const data = await profiles.updateOwnProfile(request.user.id, request.body, database);
      response.json({ message: "Your profile has been updated.", data });
    },

    async updatePhoto(request, response) {
      const data = await profiles.updateOwnPhoto(request.user.id, request.file, database);
      response.json({ message: "Your profile photo has been updated.", data });
    },

    async getPhoto(request, response) {
      const photo = await profiles.getOwnPhoto(request.user.id, database);
      response.set({
        "Content-Type": photo.content_type,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      });
      response.send(Buffer.from(photo.data));
    },

    async deletePhoto(request, response) {
      const data = await profiles.removeOwnPhoto(request.user.id, database);
      response.json({ message: "Your profile photo has been removed.", data });
    },
  };
}
