import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleStatus } from '@prisma/client';

export interface MedicationHistoryFilter {
  startDate?: Date | string;
  endDate?: Date | string;
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
    complianceRate: number;
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
    try {
      // ── Validate patientId ────────────────────────────────────────────────
      if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
        throw new BadRequestException('patientId tidak valid');
      }

      // ── Validate date inputs ──────────────────────────────────────────────
      if (filter.startDate !== undefined && filter.startDate !== null && filter.startDate !== '') {
        const parsed = new Date(filter.startDate);
        if (isNaN(parsed.getTime())) {
          throw new BadRequestException('startDate tidak valid');
        }
      }

      if (filter.endDate !== undefined && filter.endDate !== null && filter.endDate !== '') {
        const parsed = new Date(filter.endDate);
        if (isNaN(parsed.getTime())) {
          throw new BadRequestException('endDate tidak valid');
        }
      }

      if (
        filter.startDate &&
        filter.endDate &&
        new Date(filter.startDate) > new Date(filter.endDate)
      ) {
        throw new BadRequestException('startDate tidak boleh lebih besar dari endDate');
      }

      // ── 1. Ambil user + profil pasien ─────────────────────────────────────
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

      // ── 2. Build where clause untuk filter tanggal & status ───────────────
      const whereConsumption: Record<string, any> = {
        patient_id: patientId,
      };

      const formattedFilter: {
        startDate?: Date;
        endDate?: Date;
        status?: ScheduleStatus;
      } = {
        status: filter.status,
      };

      if (filter.startDate || filter.endDate) {
        whereConsumption.created_at = {};

        if (filter.startDate) {
          const startOfDate = new Date(filter.startDate);
          startOfDate.setHours(0, 0, 0, 0);
          whereConsumption.created_at.gte = startOfDate;
          formattedFilter.startDate = startOfDate;
        }

        if (filter.endDate) {
          // Inklusif sampai akhir hari (23:59:59.999)
          const endOfDate = new Date(filter.endDate);
          endOfDate.setHours(23, 59, 59, 999);
          whereConsumption.created_at.lte = endOfDate;
          formattedFilter.endDate = endOfDate;
        }
      }

      if (filter.status) {
        whereConsumption.verification_status = filter.status;
      }

      // ── 3. Ambil semua konsumsi beserta relasi ────────────────────────────
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

      // ── 4. Hitung summary data ────────────────────────────────────────────
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

      // ── 5. Map ke format ConsumptionRecord ────────────────────────────────
      const consumptionRecords: ConsumptionRecord[] = consumptions.map((c) => ({
        id: c.id,
        medicineName: c.schedule?.medicine?.name ?? 'Obat Tidak Diketahui',
        dose: c.schedule?.dose ?? '-',
        scheduledTime: c.schedule?.time ?? '--:--',
        consumedAt: c.created_at,
        verificationStatus: c.verification_status,
        verifiedAt: c.verified_at ?? undefined,
        verifiedByName: c.verified_by?.username ?? undefined,
        rejectionReason: c.rejection_reason ?? undefined,
        proofImage: c.proof_image,
      }));

      // ── 6. Return final report data ───────────────────────────────────────
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
        filter: formattedFilter,
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

    } catch (err) {
      // Re-throw NestJS HTTP exceptions as-is
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }

      // Log unknown errors and wrap them
      console.error('[MedicationHistoryService] getPatientReportData error:', {
        patientId,
        filter,
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
      });

      throw new InternalServerErrorException(
        'Terjadi kesalahan saat mengambil data laporan. Silakan coba lagi.',
      );
    }
  }
}