import { pool } from '@/lib/db';
import { AuthService } from '../auth/service.ts';
import { SupportService } from './service.ts';
import { createSupportHandler } from './http-handlers.ts';
export const supportHandler = createSupportHandler(new AuthService({ pool }), new SupportService(pool), process.env.APP_ORIGIN);
