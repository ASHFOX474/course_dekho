import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { ValidationError, NotFoundError } from "../api/errors.ts";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const types: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.txt': 'text/plain', '.csv': 'text/csv',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.zip': 'application/zip',
};
export interface StoredFile { storageKey: string; originalFileName: string; mimeType: string; fileSizeBytes: number; checksumSha256: string }
function filePath(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new NotFoundError('File not found.');
  return join(resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || '.data/uploads'), key);
}
export async function saveFile(file: File): Promise<StoredFile> {
  const mimeType = types[extname(file.name).toLowerCase()];
  if (!mimeType || file.size === 0 || file.size > MAX_FILE_BYTES) {
    throw new ValidationError('Choose a supported, non-empty file up to 20 MB.', { file: ['Supported: PDF, images, Office documents, TXT, CSV, ZIP. Maximum 20 MB.'] });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = extname(file.name).toLowerCase();
  const valid = ext === '.pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
    : ext === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : ['.jpg', '.jpeg'].includes(ext) ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : ext === '.gif' ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())
    : ext === '.webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    : ['.zip','.docx','.pptx','.xlsx'].includes(ext) ? bytes[0] === 80 && bytes[1] === 75
    : ['.doc','.ppt','.xls'].includes(ext) ? bytes.subarray(0, 8).equals(Buffer.from([208,207,17,224,161,177,26,225])) : !bytes.includes(0);
  if (!valid) throw new ValidationError('The file contents do not match its extension.', { file: ['Choose a valid file.'] });
  const storageKey = randomUUID();
  await mkdir(resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || '.data/uploads'), { recursive: true });
  await writeFile(/* turbopackIgnore: true */ filePath(storageKey), bytes, { flag: 'wx' });
  return { storageKey, originalFileName: file.name.replace(/[\\/\r\n\x00-\x1f]/g, '_').slice(0, 240), mimeType, fileSizeBytes: bytes.length, checksumSha256: createHash('sha256').update(bytes).digest('hex') };
}
export async function removeFile(key: string) { await unlink(/* turbopackIgnore: true */ filePath(key)); }
export async function loadFile(key: string) {
  try { return await readFile(/* turbopackIgnore: true */ filePath(key)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundError('The uploaded file is missing from storage.'); throw error; }
}

export async function readSubmissionForm(request: Request): Promise<{ input: unknown; file?: File }> {
  // Bound the actual stream as well as declared size before parsing multipart data.
  const limit = MAX_FILE_BYTES + 128 * 1024;
  if (Number(request.headers.get('content-length')) > limit) throw new ValidationError('Upload exceeds 20 MB.', {});
  const reader = request.body?.getReader();
  if (!reader) throw new ValidationError('Submission body is missing.', {});
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new ValidationError('Upload exceeds 20 MB.', {}); }
    chunks.push(value);
  }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { 'content-type': request.headers.get('content-type')! } }).formData(); }
  catch { throw new ValidationError('Invalid attachment form.', {}); }
  const input: Record<string, unknown> = {};
  let file: File | undefined;
  for (const [key, value] of form.entries()) {
    if (key === 'file' && value instanceof File && !file) file = value;
    else if (key === 'file' || key in input) throw new ValidationError('Only one attachment is supported.', {});
    else input[key] = value;
  }
  return { input, file };
}
