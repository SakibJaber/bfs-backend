import { Module, Global } from '@nestjs/common';
import { OwnershipGuard } from './guards/ownership.guard';

@Global()
@Module({
  providers: [OwnershipGuard],
  exports: [OwnershipGuard],
})
export class CommonModule {}
