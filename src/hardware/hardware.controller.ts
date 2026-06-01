import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { HardwareService } from './hardware.service';

@Controller('hardware')
export class HardwareController {
  constructor(private hardwareService: HardwareService) {}

  @Get('check-schedule')
  checkSchedule(@Headers('x-api-key') apiKey: string) {
    if (apiKey !== process.env.HARDWARE_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }
    return this.hardwareService.check2Schedule();
  }
}
