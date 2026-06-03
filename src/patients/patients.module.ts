import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { EmailVerificationService } from '../auth/email-verification.service';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, EmailVerificationService],
})
export class PatientsModule {}