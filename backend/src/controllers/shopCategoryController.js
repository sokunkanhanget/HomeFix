import * as categories from "../services/shopCategoryService.js";

export function createShopCategoryController(database) {
  return {
    async listServiceCategories(_request, response) {
      response.json(await categories.listServiceCategories(database));
    },
    async getOwnerCategories(request, response) {
      response.set("Cache-Control", "private, no-store");
      response.json(await categories.getOwnerCategories(request.user, database));
    },
    async replaceOwnerCategories(request, response) {
      response.json(await categories.replaceOwnerCategories(request.user, request.body, database));
    },
    async addOwnerCategory(request, response) {
      response.status(201).json(await categories.addOwnerCategory(request.user, request.body, database));
    },
    async removeOwnerCategory(request, response) {
      response.json(await categories.removeOwnerCategory(request.user, request.params.category, database));
    },
  };
}
