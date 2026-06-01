import { Module } from '@nestjs/common';
import { HardwareController } from './hardware.controller';
import { HardwareService } from './hardware.service';

@Module({
  controllers: [HardwareController],
  providers: [HardwareService],
})
export class HardwareModule {}
