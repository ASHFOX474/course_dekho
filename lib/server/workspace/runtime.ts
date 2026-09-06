import { pool } from "@/lib/db";

import { AuthService } from "../auth/service.ts";
import { WorkspaceService } from "./service.ts";
import { createWorkspaceHttpHandlers } from "./http-handlers.ts";

const authService = new AuthService({ pool });
const workspaceService = new WorkspaceService({ pool });

export const workspaceHttpHandlers = createWorkspaceHttpHandlers({
  authService,
  workspaceService,
  appOrigin: process.env.APP_ORIGIN,
  onUnexpectedError(error) {
    if (error instanceof Error) {
      console.error("Workspace request failed unexpectedly", { name: error.name });
    } else {
      console.error("Workspace request failed unexpectedly");
    }
  },
});
