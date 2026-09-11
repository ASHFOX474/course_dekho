import type { Pool, PoolClient } from "pg";

import type { CourseSummaryDto, UserSummaryDto } from "../../lib/server/api/dtos.ts";
import { toCourseDto, toUserSummaryDto } from "../../lib/server/api/mappers.ts";
import { courseRowToDomain } from "../../lib/server/db/row-mappers.ts";
import type { AuthUserRow, CourseRow } from "../../lib/server/db/rows.ts";
import { withTransaction } from "../../lib/server/db/transaction.ts";
import type { AuthenticatedUser, Course } from "../../lib/server/domain/models.ts";
import { createRepositories } from "../../lib/server/repositories/index.ts";

declare const pool: Pool;
declare const client: PoolClient;
declare const courseRow: CourseRow;
declare const authUserRow: AuthUserRow;
declare const authenticatedUser: AuthenticatedUser;

createRepositories(pool);
createRepositories(client);
withTransaction(pool, async (transactionClient) => {
  createRepositories(transactionClient);
});

const course: Course = courseRowToDomain(courseRow);
const dto: CourseSummaryDto = toCourseDto(course);
void dto;

// @ts-expect-error Database snake_case rows are not API DTOs.
const leakedDatabaseRow: CourseSummaryDto = courseRow;
void leakedDatabaseRow;

const userDto: UserSummaryDto = toUserSummaryDto(authenticatedUser);
void userDto;

// @ts-expect-error Internal IDs and snake_case rows never become public users.
const leakedAuthRow: UserSummaryDto = authUserRow;
void leakedAuthRow;
