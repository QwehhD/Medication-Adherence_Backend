import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as Express from 'express';
import { MedicationHistoryService } from './medication-history.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

export class MedicationHistoryQueryDto {
  startDate?: string;   // ISO date string, e.g. "2024-01-01"
  endDate?: string;     // ISO date string, e.g. "2024-12-31"
  status?: string;      // APPROVED | REJECTED | WAITING_VERIFICATION | etc.
}

@Controller('medication-history')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicationHistoryController {
  constructor(
    private readonly medicationHistoryService: MedicationHistoryService,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {}

  /**
   * GET /medication-history/:patientId/pdf
   *
   * Doctor bisa download PDF pasien manapun yang di-assign ke dia.
   * Patient hanya bisa download PDF milik dirinya sendiri.
   */
  @Get(':patientId/pdf')
  @Roles('DOCTOR', 'PATIENT')
  async downloadPdf(
    @Param('patientId') patientId: string,
    @Query() query: MedicationHistoryQueryDto,
    @Request() req: any,
    @Res() res: Express.Response,
  ) {
    const currentUser = req.user;

    // Guard: Patient hanya boleh akses data miliknya sendiri
    if (currentUser.role === 'PATIENT' && currentUser.sub !== patientId) {
      throw new ForbiddenException('Anda hanya bisa mengakses riwayat Anda sendiri');
    }

    // Ambil data history pasien beserta profil
    const reportData = await this.medicationHistoryService.getPatientReportData(
      patientId,
      {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        status: query.status as any,
      },
    );

    if (!reportData) {
      throw new NotFoundException('Data pasien tidak ditemukan');
    }

    // Generate PDF
    const pdfBuffer = await this.pdfGeneratorService.generateMedicationReport(reportData);

    // Set headers untuk download
    const filename = `riwayat-obat-${reportData.patient.username}-${new Date().toISOString().split('T')[0]}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  /**
   * GET /medication-history/:patientId
   *
   * Ambil data riwayat sebagai JSON (untuk tampilan frontend sebelum download PDF)
   */
  @Get(':patientId')
  @Roles('DOCTOR', 'PATIENT')
  async getHistory(
    @Param('patientId') patientId: string,
    @Query() query: MedicationHistoryQueryDto,
    @Request() req: any,
  ) {
    const currentUser = req.user;

    if (currentUser.role === 'PATIENT' && currentUser.sub !== patientId) {
      throw new ForbiddenException('Anda hanya bisa mengakses riwayat Anda sendiri');
    }

    return this.medicationHistoryService.getPatientReportData(patientId, {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      status: query.status as any,
    });
  }
}