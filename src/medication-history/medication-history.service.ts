import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleStatus } from '@prisma/client';

export interface MedicationHistoryFilter {
  startDate?: Date;
  endDate?: Date;
  status?: ScheduleStatus;
}

export interface ConsumptionRecord {
  id: string;
  medicineName: string;
  dose: string;
  scheduledTime: string;       // e.g. "08:00"
  consumedAt: Date;            // created_at dari MedicationConsumption
  verificationStatus: ScheduleStatus;
  verifiedAt?: Date;
  verifiedByName?: string;
  rejectionReason?: string;
  proofImage: string;
}

export interface PatientReportData {
  generatedAt: Date;
  patient: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    age: number;
    mainDisease: string;
    whatsappNumber: string;
  };
  assignedDoctor?: {
    username: string;
    email: string;
  };
  filter: {
    startDate?: Date;
    endDate?: Date;
    status?: ScheduleStatus;
  };
  summary: {
    total: number;
    approved: number;
    rejected: number;
    waitingVerification: number;
    missed: number;
    complianceRate: number; // persentase APPROVED dari semua yang ada jadwalnya
  };
  consumptions: ConsumptionRecord[];
}

@Injectable()
export class MedicationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getPatientReportData(
    patientId: string,
    filter: MedicationHistoryFilter = {},
  ): Promise<PatientReportData> {
    // 1. Ambil user + profil pasien
    const user = await this.prisma.user.findUnique({
      where: { id: patientId },
      include: {
        patientProfile: {
          include: {
            assigned_doctor: true,
          },
        },
      },
    });

    if (!user || user.role !== 'PATIENT') {
      throw new NotFoundException('Pasien tidak ditemukan');
    }

    const profile = user.patientProfile;
    if (!profile) {
      throw new NotFoundException('Profil pasien tidak ditemukan');
    }

    // 2. Build where clause untuk filter tanggal & status
    const whereConsumption: any = {
      patient_id: patientId,
    };

    if (filter.startDate || filter.endDate) {
      whereConsumption.created_at = {};
      if (filter.startDate) {
        whereConsumption.created_at.gte = filter.startDate;
      }
      if (filter.endDate) {
        // Inklusif sampai akhir hari
        const endOfDay = new Date(filter.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        whereConsumption.created_at.lte = endOfDay;
      }
    }

    if (filter.status) {
      whereConsumption.verification_status = filter.status;
    }

    // 3. Ambil semua konsumsi beserta relasi
    const consumptions = await this.prisma.medicationConsumption.findMany({
      where: whereConsumption,
      include: {
        schedule: {
          include: {
            medicine: true,
          },
        },
        verified_by: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 4. Hitung summary data
    const total = consumptions.length;
    const approved = consumptions.filter(
      (c) => c.verification_status === 'APPROVED',
    ).length;
    const rejected = consumptions.filter(
      (c) => c.verification_status === 'REJECTED',
    ).length;
    const waitingVerification = consumptions.filter(
      (c) => c.verification_status === 'WAITING_VERIFICATION',
    ).length;
    const missed = consumptions.filter(
      (c) => c.verification_status === 'MISSED',
    ).length;

    // Compliance rate: APPROVED / (APPROVED + REJECTED + MISSED) * 100
    const denominator = approved + rejected + missed;
    const complianceRate =
      denominator > 0 ? Math.round((approved / denominator) * 100) : 0;

    // 5. Map ke format yang dibutuhkan
    const consumptionRecords: ConsumptionRecord[] = consumptions.map((c) => ({
      id: c.id,
      medicineName: c.schedule?.medicine?.name ?? 'Obat Tidak Diketahui',
      dose: c.schedule?.dose ?? '-',
      scheduledTime: c.schedule?.time ?? '--:--',
      consumedAt: c.created_at,
      verificationStatus: c.verification_status,
      verifiedAt: c.verified_at ?? undefined,
      verifiedByName: c.verified_by?.username,
      rejectionReason: c.rejection_reason ?? undefined,
      proofImage: c.proof_image,
    }));

    return {
      generatedAt: new Date(),
      patient: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: profile.full_name,
        age: profile.age,
        mainDisease: profile.main_disease,
        whatsappNumber: profile.whatsapp_number,
      },
      assignedDoctor: profile.assigned_doctor
        ? {
            username: profile.assigned_doctor.username,
            email: profile.assigned_doctor.email,
          }
        : undefined,
      filter,
      summary: {
        total,
        approved,
        rejected,
        waitingVerification,
        missed,
        complianceRate,
      },
      consumptions: consumptionRecords,
    };
  }
}