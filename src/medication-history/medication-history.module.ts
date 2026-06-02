import { Module } from '@nestjs/common';
import { MedicationHistoryController } from './medication-history.controller';
import { MedicationHistoryService } from './medication-history.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PrismaModule } from '../prisma/prisma.module';
 
@Module({
  imports: [PrismaModule],
  controllers: [MedicationHistoryController],
  providers: [MedicationHistoryService, PdfGeneratorService],
})
export class MedicationHistoryModule {}
 
