import { pool } from '@/lib/db';
import { AuthService } from './service.ts';
import { AccountService } from './account-service.ts';
import { createAccountHandler } from './account-http-handlers.ts';
export const accountHandler = createAccountHandler(new AuthService({ pool }), new AccountService(pool), process.env.APP_ORIGIN);
