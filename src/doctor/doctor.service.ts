import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RejectConsumptionDto } from './dto/reject-consumption.dto';

@Injectable()
export class DoctorService {
  constructor(private prisma: PrismaService) {}

  async getWaitingVerifications(doctorId: string) {
    return this.prisma.medicationConsumption.findMany({
      where: {
        verification_status: 'WAITING_VERIFICATION',
        patient: {
          patientProfile: {
            assigned_doctor_id: doctorId,
          },
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            email: true,
            patientProfile: true,
          },
        },
        schedule: {
          include: {
            medicine: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async approveConsumption(id: string, doctorId: string) {
    const consumption = await this.prisma.medicationConsumption.findUnique({
      where: { id },
    });
    if (!consumption) throw new NotFoundException('Consumption not found');

    const [updated] = await this.prisma.$transaction([
      this.prisma.medicationConsumption.update({
        where: { id },
        data: {
          verification_status: 'APPROVED',
          verified_at: new Date(),
          verified_by_id: doctorId,
        },
      }),
      this.prisma.schedule.update({
        where: { id: consumption.schedule_id },
        data: { status: 'APPROVED' },
      }),
    ]);

    return updated;
  }

  async rejectConsumption(id: string, doctorId: string, dto: RejectConsumptionDto) {
    const consumption = await this.prisma.medicationConsumption.findUnique({
      where: { id },
    });
    if (!consumption) throw new NotFoundException('Consumption not found');

    const [updated] = await this.prisma.$transaction([
      this.prisma.medicationConsumption.update({
        where: { id },
        data: {
          verification_status: 'REJECTED',
          verified_at: new Date(),
          verified_by_id: doctorId,
          rejection_reason: dto.rejection_reason,
        },
      }),
      this.prisma.schedule.update({
        where: { id: consumption.schedule_id },
        data: { status: 'REJECTED' },
      }),
    ]);

    return updated;
  }
}