import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduleStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

// ─── Excel constants ──────────────────────────────────────────────────────────
const HEADER_BG = '1F4E79';
const HEADER_FG = 'FFFFFFFF';

const STATUS_FILL: Record<string, string> = {
  PENDING:              'FFFFF3CD',
  WAITING_VERIFICATION: 'FFCCE5FF',
  APPROVED:             'FFD4EDDA',
  REJECTED:             'FFF8D7DA',
  MISSED:               'FFE2E3E5',
};

interface ExportFilter {
  doctorId:   string;
  patientId?: string;
  status?:    ScheduleStatus;
  from?:      Date;
  to?:        Date;
}

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Cron 1: Kurangi stok saat jadwal tiba ───────────────────────────────
  /**
   * Jalan setiap menit.
   * Hanya mengurangi stok medicine untuk schedule PENDING yang waktunya cocok.
   * TIDAK mengubah status — HardwareService yang bertanggung jawab atas
   * perubahan PENDING → WAITING_VERIFICATION saat ESP32 berhasil dispense.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async deductStockOnScheduledTime(): Promise<void> {
    const { hh, mm } = this.getWIBTime();
    const current    = `${hh}:${mm}`;

    const due = await this.prisma.schedule.findMany({
      where: {
        status: 'PENDING',
        time:   { in: [current, `${parseInt(hh)}:${mm}`] },
      },
      include: { medicine: true },
    });

    if (!due.length) return;

    this.logger.log(
      `[StockDeduct] ${current} WIB — ${due.length} schedule(s) due`,
    );

    for (const schedule of due) {
      const tabletCount = this.parseDoseTablets(schedule.dose);

      try {
        await this.prisma.$transaction(async (tx) => {
          const medicine = await tx.medicine.findUnique({
            where: { id: schedule.medicine_id },
          });
          if (!medicine) {
            this.logger.warn(
              `[StockDeduct] Medicine ${schedule.medicine_id} not found — skip schedule ${schedule.id}`,
            );
            return;
          }

          const deduct = Math.min(tabletCount, medicine.stock);

          await tx.medicine.update({
            where: { id: medicine.id },
            data:  { stock: { decrement: deduct } },
          });

          this.logger.log(
            `[StockDeduct] "${medicine.name}" stock ${medicine.stock} → ${medicine.stock - deduct} (−${deduct})`,
          );
          // ⚠️ Tidak ada update status di sini — biarkan HardwareService yang handle
        });
      } catch (err) {
        this.logger.error(
          `[StockDeduct] Failed for schedule ${schedule.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  // ─── Cron 2: Tandai MISSED jika 2 menit lewat masih PENDING ─────────────
  /**
   * Jalan setiap menit.
   * Schedule yang masih PENDING padahal waktunya sudah lewat > 2 menit
   * (artinya ESP32 tidak pernah dispense) → tandai MISSED.
   * Jeda 2 menit memberi ruang ESP32 untuk poll dan update status duluan.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async markMissedSchedules(): Promise<void> {
    const { hh, mm } = this.getWIBTime();
    const nowMinutes = parseInt(hh) * 60 + parseInt(mm);

    const pendingSchedules = await this.prisma.schedule.findMany({
      where: { status: 'PENDING' },
    });

    const missed: string[] = [];

    for (const schedule of pendingSchedules) {
      const [schedHH, scheduleMM] = schedule.time.split(':').map(Number);
      const scheduleMinutes       = schedHH * 60 + scheduleMM;

      // Tandai MISSED jika sudah lewat lebih dari 2 menit
      if (nowMinutes - scheduleMinutes >= 2) {
        missed.push(schedule.id);
      }
    }

    if (!missed.length) return;

    await this.prisma.schedule.updateMany({
      where: { id: { in: missed } },
      data:  { status: 'MISSED' },
    });

    this.logger.log(`[MarkMissed] Marked ${missed.length} schedule(s) as MISSED`);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private getWIBTime(): { hh: string; mm: string } {
    const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return {
      hh: String(wib.getUTCHours()).padStart(2, '0'),
      mm: String(wib.getUTCMinutes()).padStart(2, '0'),
    };
  }

  private parseDoseTablets(dose: string): number {
    const match = dose.match(/(\d+(?:\.\d+)?)/);
    if (!match) return 1;
    return Math.max(1, Math.round(parseFloat(match[1])));
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async findAll(doctorId: string) {
    return this.prisma.schedule.findMany({
      where:    { doctor_id: doctorId },
      orderBy:  { created_at: 'desc' },
      include: {
        patient:  { select: { id: true, email: true, patientProfile: true } },
        medicine: true,
        doctor:   { select: { id: true, email: true } },
      },
    });
  }

  async findOne(id: string, doctorId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where:   { id },
      include: {
        patient:      { select: { id: true, email: true, patientProfile: true } },
        medicine:     true,
        doctor:       { select: { id: true, email: true } },
        consumptions: true,
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (schedule.doctor_id !== doctorId) throw new ForbiddenException('Access denied');
    return schedule;
  }

  async create(doctorId: string, dto: CreateScheduleDto) {
    const patient = await this.prisma.user.findUnique({ where: { id: dto.patient_id } });
    if (!patient)
      throw new NotFoundException(`Patient with id ${dto.patient_id} not found`);

    const medicine = await this.prisma.medicine.findUnique({ where: { id: dto.medicine_id } });
    if (!medicine)
      throw new NotFoundException(`Medicine with id ${dto.medicine_id} not found`);

    return this.prisma.$transaction(
      dto.times.map((time) =>
        this.prisma.schedule.create({
          data: {
            doctor_id:   doctorId,
            patient_id:  dto.patient_id,
            medicine_id: dto.medicine_id,
            dose:        dto.dose,
            time,
            status:      'PENDING',
          },
        }),
      ),
    );
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('Schedule not found');

    if (dto.medicine_id) {
      const medicine = await this.prisma.medicine.findUnique({ where: { id: dto.medicine_id } });
      if (!medicine) throw new NotFoundException('Medicine not found');
    }

    const { times, end_date, ...rest } = dto;
    const data: any = { ...rest };
    if (times && times.length > 0) data.time = times[0];

    return this.prisma.schedule.update({ where: { id }, data });
  }

  async remove(id: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('Schedule not found');

    await this.prisma.medicationConsumption.deleteMany({ where: { schedule_id: id } });
    await this.prisma.schedule.delete({ where: { id } });
    return { message: 'Schedule deleted successfully' };
  }

  // ─── Export ──────────────────────────────────────────────────────────────

  async exportToExcel(filter: ExportFilter): Promise<Buffer> {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        doctor_id: filter.doctorId,
        ...(filter.patientId && { patient_id: filter.patientId }),
        ...(filter.status    && { status:     filter.status    }),
        ...((filter.from || filter.to) && {
          created_at: {
            ...(filter.from && { gte: filter.from }),
            ...(filter.to   && { lte: filter.to   }),
          },
        }),
      },
      orderBy: { created_at: 'desc' },
      include: {
        patient:  { select: { username: true, patientProfile: { select: { full_name: true } } } },
        doctor:   { select: { username: true } },
        medicine: { select: { name: true, slot_number: true } },
      },
    });

    const wb   = new ExcelJS.Workbook();
    wb.creator = 'Adherify';
    wb.created = new Date();

    this.buildMainSheet(wb, schedules);
    this.buildLegendSheet(wb);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private buildMainSheet(wb: ExcelJS.Workbook, schedules: any[]) {
    const ws = wb.addWorksheet('Jadwal Obat', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { key: 'no',         header: 'No',          width: 5  },
      { key: 'patient',    header: 'Patient Name', width: 24 },
      { key: 'medicine',   header: 'Medicine',     width: 20 },
      { key: 'slot',       header: 'Slot No.',     width: 10 },
      { key: 'dose',       header: 'Dose',         width: 12 },
      { key: 'time',       header: 'Time',         width: 10 },
      { key: 'status',     header: 'Status',       width: 22 },
      { key: 'doctor',     header: 'Doctor',       width: 24 },
      { key: 'created_at', header: 'Created At',   width: 22 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font      = { bold: true, color: { argb: HEADER_FG }, name: 'Arial', size: 11 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_BG}` } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border    = this.thinBorder();
    });

    const centerCols = new Set(['no', 'slot', 'dose', 'time']);

    schedules.forEach((s, idx) => {
      const patientName = s.patient?.patientProfile?.full_name ?? s.patient?.username ?? '-';
      const row = ws.addRow({
        no:         idx + 1,
        patient:    patientName,
        medicine:   s.medicine?.name        ?? '-',
        slot:       s.medicine?.slot_number ?? '-',
        dose:       s.dose,
        time:       s.time,
        status:     s.status,
        doctor:     `dr. ${s.doctor?.username ?? '-'}`,
        created_at: this.formatDate(s.created_at),
      });

      row.height       = 20;
      const bgArgb     = STATUS_FILL[s.status] ?? 'FFFFFFFF';
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const key = ws.getColumn(colNumber).key as string;
        cell.font      = { name: 'Arial', size: 10 };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.alignment = { horizontal: centerCols.has(key) ? 'center' : 'left', vertical: 'middle' };
        cell.border    = this.thinBorder();
      });
    });

    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: ws.columns.length },
    };
  }

  private buildLegendSheet(wb: ExcelJS.Workbook) {
    const ws = wb.addWorksheet('Keterangan Status');
    ws.columns = [
      { key: 'status', header: 'Status',     width: 24 },
      { key: 'desc',   header: 'Keterangan', width: 55 },
    ];

    ws.getRow(1).eachCell((cell) => {
      cell.font      = { bold: true, color: { argb: HEADER_FG }, name: 'Arial', size: 10 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_BG}` } };
      cell.alignment = { vertical: 'middle' };
      cell.border    = this.thinBorder();
    });

    const legend = [
      { status: 'PENDING',              desc: 'Jadwal belum dimulai' },
      { status: 'WAITING_VERIFICATION', desc: 'Foto konsumsi sudah dikirim, menunggu verifikasi dokter' },
      { status: 'APPROVED',             desc: 'Dokter telah memverifikasi konsumsi obat' },
      { status: 'REJECTED',             desc: 'Konsumsi ditolak oleh dokter, perlu foto ulang' },
      { status: 'MISSED',               desc: 'Jadwal terlewat / tidak dikonsumsi' },
    ];

    legend.forEach(({ status, desc }) => {
      const row    = ws.addRow({ status, desc });
      row.height   = 22;
      const bgArgb = STATUS_FILL[status] ?? 'FFFFFFFF';
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font      = { name: 'Arial', size: 10 };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border    = this.thinBorder();
      });
    });
  }

  private thinBorder(): Partial<ExcelJS.Borders> {
    const s: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFBDD7EE' } };
    return { top: s, bottom: s, left: s, right: s };
  }

  private formatDate(date: Date | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('id-ID', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }
}