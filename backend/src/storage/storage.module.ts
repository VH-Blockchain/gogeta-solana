import { Global, Module } from '@nestjs/common';
import {
  LocalDiskStorageService,
  S3StorageService,
  StorageService,
} from './storage.service';

/** Picks the storage driver from STORAGE_DRIVER (default `local`). */
@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useClass:
        process.env.STORAGE_DRIVER === 's3' ? S3StorageService : LocalDiskStorageService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
