import { pool } from "@/lib/db";

import { AuthService } from "../auth/service.ts";
import { PostgresCatalogRepository } from "../repositories/catalog-repository.ts";
import { createCatalogHttpHandlers } from "./http-handlers.ts";
import { CatalogService } from "./service.ts";

const authService = new AuthService({ pool });
const catalogService = new CatalogService(new PostgresCatalogRepository(pool));

export const catalogHttpHandlers = createCatalogHttpHandlers({
  authService,
  catalogService,
  onUnexpectedError(error) {
    // Database/driver messages can contain connection details or row values.
    // Log only allowlisted metadata at this boundary.
    if (error instanceof Error) {
      console.error("Catalog request failed unexpectedly", { name: error.name });
    } else {
      console.error("Catalog request failed unexpectedly");
    }
  },
});
