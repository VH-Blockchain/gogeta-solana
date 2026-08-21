import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, promises as fs } from 'fs';
import { extname, join } from 'path';

/**
 * Local directory for the disk driver. Served statically at /api/uploads
 * (see main.ts). In production, mount a PERSISTENT volume here.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

/**
 * Storage abstraction for uploaded media. We persist only the returned public
 * URL in the DB, so the backing store is swappable without touching the DB,
 * app or admin. Select the driver with STORAGE_DRIVER (`local` default | `s3`).
 *
 * To move to S3 later: implement S3StorageService.save(), `npm i
 * @aws-sdk/client-s3`, set STORAGE_DRIVER=s3 + the S3_* env vars. Nothing else
 * changes.
 */
export abstract class StorageService {
  /**
   * Persist an uploaded file and return its public URL.
   * @param origin request origin (e.g. https://host) — used by the local
   *   driver to build an absolute URL; ignored by remote drivers.
   */
  abstract save(file: Express.Multer.File, origin: string): Promise<string>;
}

/** Writes files to UPLOAD_DIR; URLs resolve via the /api/uploads static route. */
@Injectable()
export class LocalDiskStorageService extends StorageService {
  constructor() {
    super();
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async save(file: Express.Multer.File, origin: string): Promise<string> {
    const name = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
    await fs.writeFile(join(UPLOAD_DIR, name), file.buffer);
    // Prefer PUBLIC_BASE_URL (set to the https public origin) so URLs are https
    // behind a reverse proxy — the request-derived origin can be http when the
    // proxy doesn't forward x-forwarded-proto, and Android blocks cleartext.
    const base = (process.env.PUBLIC_BASE_URL || origin).replace(/\/+$/, '');
    return `${base}/api/uploads/${name}`;
  }
}

/**
 * Object-storage driver (S3 / R2 / any S3-compatible). SEAM ONLY — not yet
 * implemented. When production scale is needed:
 *   1. `npm i @aws-sdk/client-s3`
 *   2. Implement save(): PutObject to the bucket, return the CDN/public URL.
 *   3. Set STORAGE_DRIVER=s3 and S3_BUCKET / S3_REGION / S3_PUBLIC_BASE_URL /
 *      credentials.
 */
@Injectable()
export class S3StorageService extends StorageService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async save(_file: Express.Multer.File, _origin: string): Promise<string> {
    throw new Error(
      'S3 storage driver is not implemented yet. Install @aws-sdk/client-s3, ' +
        'implement S3StorageService.save(), and set the S3_* env vars.',
    );
  }
}
