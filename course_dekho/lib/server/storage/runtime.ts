import { pool } from '@/lib/db';
import { AuthService } from '../auth/service.ts';
import { createAttachmentHandler } from './http-handlers.ts';
export const attachmentHandler = createAttachmentHandler(pool, new AuthService({ pool }));
