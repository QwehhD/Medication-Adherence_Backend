import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { MedicationsModule } from './medications/medications.module';
import { SchedulesModule } from './schedules/schedules.module';
import { PatientModule } from './patient/patient.module';
import { DoctorModule } from './doctor/doctor.module';
import { ReminderModule } from './reminder/reminder.module';
import { HardwareModule } from './hardware/hardware.module';
import { ClsModule } from 'nestjs-cls/dist/src/lib/cls-module/cls.module';
import { MedicationHistoryModule } from './medication-history/medication-history.module';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    PatientsModule,
    MedicationsModule,
    SchedulesModule,
    PatientModule,
    DoctorModule,
    ReminderModule,
    HardwareModule,
    MedicationHistoryModule,
  ],
})
export class AppModule {}
