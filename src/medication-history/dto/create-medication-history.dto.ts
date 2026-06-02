import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ScheduleStatus } from '@prisma/client';

export class GetMedicationHistoryDto {
  @IsOptional()
  @IsDateString({}, { message: 'startDate harus berupa format tanggal ISO 8601 yang valid' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate harus berupa format tanggal ISO 8601 yang valid' })
  endDate?: string;

  @IsOptional()
  @IsEnum(ScheduleStatus, {
    message: 'Status harus berupa salah satu dari: PENDING, WAITING_VERIFICATION, APPROVED, REJECTED, MISSED',
  })
  status?: ScheduleStatus;
}