import { pool } from "@/lib/db";

import { createAuthHttpHandlers } from "./http-handlers.ts";
import { AuthService } from "./service.ts";

const authService = new AuthService({ pool });

export const authHttpHandlers = createAuthHttpHandlers({
  service: authService,
  appOrigin: process.env.APP_ORIGIN,
  secureCookies: process.env.NODE_ENV === "production" ? true : undefined,
  onUnexpectedError(error) {
    // Do not serialize or log messages here: database/driver messages can
    // contain connection details, query fragments, or user-controlled values.
    if (error instanceof Error) {
      console.error("Auth request failed unexpectedly", {
        name: error.name,
      });
    } else {
      console.error("Auth request failed unexpectedly");
    }
  },
});
