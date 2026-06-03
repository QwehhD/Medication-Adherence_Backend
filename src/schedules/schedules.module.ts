import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // enables @Cron decorators in this module
    PrismaModule,
  ],
  controllers: [SchedulesController],
  providers:   [SchedulesService],
})
export class SchedulesModule {}