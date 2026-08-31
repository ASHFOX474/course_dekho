import { ValidationError } from "./errors.ts";
import { resourceTypes } from "../domain/models.ts";
import type {
  CreateSubmissionRequestDto,
  LoginRequestDto,
  RegisterRequestDto,
  RejectSubmissionRequestDto,
} from "./dtos.ts";
import type { CourseFilters } from "../domain/models.ts";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FieldErrors = Record<string, string[]>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addError(errors: FieldErrors, field: string, message: string): void {
  (errors[field] ??= []).push(message);
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  errors: FieldErrors
): void {
  const allowedFields = new Set(allowed);
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) addError(errors, field, `${field} is not allowed.`);
  }
}

function readText(
  value: unknown,
  field: string,
  maximumLength: number,
  errors: FieldErrors
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(errors, field, `${field} is required.`);
    return "";
  }

  const text = value.trim();
  if (text.length > maximumLength) {
    addError(errors, field, `${field} must be at most ${maximumLength} characters.`);
  }
  return text;
}

function readOptionalText(
  value: unknown,
  field: string,
  maximumLength: number,
  errors: FieldErrors
): string | undefined {
  if (value === undefined) return undefined;
  return readText(value, field, maximumLength, errors);
}

function readPublicId(value: unknown, field: string, errors: FieldErrors): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    addError(errors, field, `${field} must be a valid public UUID.`);
    return "";
  }
  return value.toLowerCase();
}

function throwIfInvalid(errors: FieldErrors): void {
  if (Object.keys(errors).length > 0) {
    throw new ValidationError("Request validation failed.", errors);
  }
}

export function validatePublicId(value: unknown, field = "id"): string {
  const errors: FieldErrors = {};
  const publicId = readPublicId(value, field, errors);
  throwIfInvalid(errors);
  return publicId;
}

export function validateCourseListQuery(searchParams: URLSearchParams): CourseFilters {
  const errors: FieldErrors = {};
  const allowedFields = new Set(["universityId", "semesterId", "query"]);

  for (const field of new Set(searchParams.keys())) {
    if (!allowedFields.has(field)) {
      addError(errors, field, `${field} is not allowed.`);
      continue;
    }
    if (searchParams.getAll(field).length !== 1) {
      addError(errors, field, `${field} must be provided at most once.`);
    }
  }

  const universityValue = searchParams.get("universityId");
  const semesterValue = searchParams.get("semesterId");
  const queryValue = searchParams.get("query");

  const universityId =
    universityValue === null
      ? undefined
      : readPublicId(universityValue, "universityId", errors);
  const semesterId =
    semesterValue === null
      ? undefined
      : readPublicId(semesterValue, "semesterId", errors);
  const query =
    queryValue === null ? undefined : readText(queryValue, "query", 100, errors);

  throwIfInvalid(errors);

  const filters: CourseFilters = {};
  if (universityId !== undefined) filters.universityId = universityId;
  if (semesterId !== undefined) filters.semesterId = semesterId;
  if (query !== undefined) filters.query = query;
  return filters;
}

export function validateCreateSubmissionRequest(value: unknown): CreateSubmissionRequestDto {
  if (!isObject(value)) {
    throw new ValidationError("Request validation failed.", {
      body: ["Request body must be a JSON object."],
    });
  }

  const errors: FieldErrors = {};
  rejectUnknownFields(
    value,
    ["resourceType", "title", "description", "courseId", "topicId"],
    errors
  );

  const resourceType = value.resourceType;
  if (
    typeof resourceType !== "string" ||
    !resourceTypes.includes(resourceType as (typeof resourceTypes)[number])
  ) {
    addError(errors, "resourceType", "resourceType is not supported.");
  }

  const title = readText(value.title, "title", 200, errors);
  const description = readText(value.description, "description", 5000, errors);
  const courseId = readPublicId(value.courseId, "courseId", errors);
  const topicId = readPublicId(value.topicId, "topicId", errors);
  throwIfInvalid(errors);

  return {
    resourceType: resourceType as CreateSubmissionRequestDto["resourceType"],
    title,
    description,
    courseId,
    topicId,
  };
}

export function validateRejectSubmissionRequest(value: unknown): RejectSubmissionRequestDto {
  if (!isObject(value)) {
    throw new ValidationError("Request validation failed.", {
      body: ["Request body must be a JSON object."],
    });
  }

  const errors: FieldErrors = {};
  rejectUnknownFields(value, ["reason"], errors);
  const reason = readText(value.reason, "reason", 1000, errors);
  throwIfInvalid(errors);
  return { reason };
}

export function validateRegisterRequest(value: unknown): RegisterRequestDto {
  if (!isObject(value)) {
    throw new ValidationError("Request validation failed.", {
      body: ["Request body must be a JSON object."],
    });
  }

  const errors: FieldErrors = {};
  rejectUnknownFields(
    value,
    [
      "name",
      "email",
      "username",
      "password",
      "role",
      "universityId",
      "department",
      "yearOfStudy",
      "designation",
    ],
    errors
  );

  const name = readText(value.name, "name", 120, errors);
  const email = readText(value.email, "email", 254, errors).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    addError(errors, "email", "email must be a valid email address.");
  }

  const username = readText(value.username, "username", 32, errors).toLowerCase();
  if (username && !/^[a-z0-9_]{3,32}$/.test(username)) {
    addError(
      errors,
      "username",
      "username must contain 3 to 32 letters, numbers, or underscores."
    );
  }

  const password = value.password;
  if (typeof password !== "string") {
    addError(errors, "password", "password is required.");
  } else if (password.length < 12 || password.length > 128) {
    addError(errors, "password", "password must be between 12 and 128 characters.");
  }

  const role = value.role;
  if (role !== "student" && role !== "teacher") {
    addError(errors, "role", "Public registration supports student or teacher accounts only.");
  }

  const universityId = readPublicId(value.universityId, "universityId", errors);
  const department = readOptionalText(value.department, "department", 120, errors);
  const designation = readOptionalText(value.designation, "designation", 160, errors);

  let yearOfStudy: number | undefined;
  if (value.yearOfStudy !== undefined) {
    if (
      typeof value.yearOfStudy !== "number" ||
      !Number.isInteger(value.yearOfStudy) ||
      value.yearOfStudy < 1 ||
      value.yearOfStudy > 6
    ) {
      addError(errors, "yearOfStudy", "yearOfStudy must be an integer from 1 to 6.");
    } else {
      yearOfStudy = value.yearOfStudy;
    }
  }

  if (role === "student" && value.designation !== undefined) {
    addError(errors, "designation", "designation is only valid for teacher accounts.");
  }
  if (role === "teacher" && value.yearOfStudy !== undefined) {
    addError(errors, "yearOfStudy", "yearOfStudy is only valid for student accounts.");
  }

  throwIfInvalid(errors);

  const result: RegisterRequestDto = {
    name,
    email,
    username,
    password: password as string,
    role: role as RegisterRequestDto["role"],
    universityId,
  };
  if (department !== undefined) result.department = department;
  if (role === "student" && yearOfStudy !== undefined) result.yearOfStudy = yearOfStudy;
  if (role === "teacher" && designation !== undefined) result.designation = designation;
  return result;
}

export function validateLoginRequest(value: unknown): LoginRequestDto {
  if (!isObject(value)) {
    throw new ValidationError("Request validation failed.", {
      body: ["Request body must be a JSON object."],
    });
  }

  const errors: FieldErrors = {};
  rejectUnknownFields(value, ["identifier", "password"], errors);
  const identifier = readText(value.identifier, "identifier", 254, errors).toLowerCase();
  const password = value.password;
  if (typeof password !== "string" || password.length === 0) {
    addError(errors, "password", "password is required.");
  } else if (password.length > 128) {
    addError(errors, "password", "password must be at most 128 characters.");
  }
  throwIfInvalid(errors);
  return { identifier, password: password as string };
}
