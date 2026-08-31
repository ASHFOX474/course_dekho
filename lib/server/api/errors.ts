import type { ApiErrorCode, ApiErrorDto } from "./dtos.ts";

export class ApplicationError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super("VALIDATION_ERROR", 400, message, fieldErrors);
    this.name = "ValidationError";
  }
}

export class UnauthenticatedError extends ApplicationError {
  constructor(message = "Authentication is required.") {
    super("UNAUTHENTICATED", 401, message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = "You do not have permission to perform this action.") {
    super("FORBIDDEN", 403, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = "The requested resource was not found.") {
    super("NOT_FOUND", 404, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApplicationError {
  constructor(message = "The request conflicts with current state.") {
    super("CONFLICT", 409, message);
    this.name = "ConflictError";
  }
}

export class InvalidTransitionError extends ApplicationError {
  constructor(message = "The requested workflow transition is not allowed.") {
    super("INVALID_TRANSITION", 409, message);
    this.name = "InvalidTransitionError";
  }
}

export interface ApiErrorMapping {
  status: number;
  body: ApiErrorDto;
}

interface PostgreSqlErrorLike {
  code: string;
}

function isPostgreSqlError(error: unknown): error is PostgreSqlErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

function applicationErrorMapping(error: ApplicationError): ApiErrorMapping {
  const body: ApiErrorDto = {
    error: {
      code: error.code,
      message: error.message,
    },
  };

  if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
    body.error.fieldErrors = error.fieldErrors;
  }

  return { status: error.status, body };
}

export function mapErrorToApi(error: unknown): ApiErrorMapping {
  if (error instanceof ApplicationError) {
    return applicationErrorMapping(error);
  }

  if (isPostgreSqlError(error)) {
    if (["23505", "23514", "40001", "40P01"].includes(error.code)) {
      return applicationErrorMapping(
        new ConflictError("The request conflicts with current persistent state.")
      );
    }

    if (["22P02", "23503"].includes(error.code)) {
      return applicationErrorMapping(
        new ValidationError("The request references invalid data.", {})
      );
    }
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    },
  };
}
