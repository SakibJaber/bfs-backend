import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { PrivateUploadService } from './private-upload.service';
import {
  UploadsModuleOptions,
  UPLOADS_OPTIONS_TOKEN,
} from './interfaces/uploads-options.interface';

export interface UploadsModuleAsyncOptions {
  imports?: any[];
  useFactory?: (
    ...args: any[]
  ) => Promise<UploadsModuleOptions> | UploadsModuleOptions;
  inject?: any[];
}

@Global()
@Module({
  controllers: [UploadsController],
  providers: [UploadsService, PrivateUploadService],
  exports: [UploadsService, PrivateUploadService],
})
export class UploadsModule {
  static registerAsync(options: UploadsModuleAsyncOptions): DynamicModule {
    const asyncOptionsProvider: Provider = {
      provide: UPLOADS_OPTIONS_TOKEN,
      useFactory: options.useFactory as (...args: any[]) => any,
      inject: options.inject || [],
    };

    const providers: Provider[] = [asyncOptionsProvider];

    return {
      module: UploadsModule,
      imports: options.imports || [],
      providers: providers,
      exports: [UPLOADS_OPTIONS_TOKEN],
    };
  }
}
