import { PartialType } from '@nestjs/swagger';
import { CreateMedicationHistoryDto } from './create-medication-history.dto';

export class UpdateMedicationHistoryDto extends PartialType(CreateMedicationHistoryDto) {}
