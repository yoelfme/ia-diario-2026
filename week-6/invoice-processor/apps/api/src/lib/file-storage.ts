import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { lookup as lookupMimeType } from 'mime-types';
import { HttpError } from './http-error.js';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf']);
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf']);

export type StoredUpload = {
  absolutePath: string;
  publicPath: string;
  originalFilename: string;
  mimeType: string;
};

function normalizeMimeType(file: File) {
  if (ALLOWED_MIME_TYPES.has(file.type)) {
    return file.type;
  }

  const inferredMimeType = lookupMimeType(file.name);
  if (typeof inferredMimeType === 'string' && ALLOWED_MIME_TYPES.has(inferredMimeType)) {
    return inferredMimeType;
  }

  return file.type;
}

export function validateUpload(file: File) {
  const extension = path.extname(file.name).toLowerCase();
  const mimeType = normalizeMimeType(file);

  if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new HttpError(415, {
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Solo se permiten archivos PNG, JPG/JPEG y PDF.',
    });
  }

  return { extension, mimeType };
}

export async function saveUpload(params: {
  file: File;
  uploadsDir: string;
  extension: string;
  mimeType: string;
}): Promise<StoredUpload> {
  const { file, uploadsDir, extension, mimeType } = params;
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const nestedDir = path.join(uploadsDir, 'invoices', year, month);
  const storedFilename = `${randomUUID()}${extension}`;
  const absolutePath = path.join(nestedDir, storedFilename);
  const publicPath = `/uploads/invoices/${year}/${month}/${storedFilename}`;

  await mkdir(nestedDir, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    absolutePath,
    publicPath,
    originalFilename: file.name,
    mimeType,
  };
}

export async function deleteStoredUpload(absolutePath: string) {
  await rm(absolutePath, { force: true });
}

export async function readStoredUpload(absolutePath: string) {
  return readFile(absolutePath);
}

export async function ensureUploadsDir(uploadsDir: string) {
  await mkdir(uploadsDir, { recursive: true });
}

export function resolveUploadPath(uploadsDir: string, requestPath: string) {
  const relativePath = requestPath.replace(/^\/uploads\//, '');
  const resolved = path.resolve(uploadsDir, relativePath);
  const uploadsRoot = path.resolve(uploadsDir);

  if (!resolved.startsWith(uploadsRoot)) {
    throw new HttpError(403, {
      code: 'INVALID_FILE_PATH',
      message: 'La ruta solicitada no es válida.',
    });
  }

  return resolved;
}

