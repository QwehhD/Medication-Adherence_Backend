import { Injectable } from '@nestjs/common';
import { TDocumentDefinitions, StyleDictionary } from 'pdfmake/interfaces';
import { PatientReportData } from './medication-history.service';
import { ScheduleStatus } from '@prisma/client';

// Mapping status ke label bahasa Indonesia
const STATUS_LABELS: Record<ScheduleStatus, string> = {
  PENDING: 'Menunggu',
  WAITING_VERIFICATION: 'Menunggu Verifikasi',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  MISSED: 'Terlewat',
};

// Warna per status
const STATUS_COLORS: Record<ScheduleStatus, string> = {
  PENDING: '#888780',
  WAITING_VERIFICATION: '#BA7517',
  APPROVED: '#3B6D11',
  REJECTED: '#A32D2D',
  MISSED: '#534AB7',
};

@Injectable()
export class PdfGeneratorService {
  private printer: any;

  constructor() {
    // Menggunakan require untuk core generator & virtual filesystem font bawaan pdfmake
    const PdfPrinter = require('pdfmake');
    const pdfMakeFonts = require('pdfmake/build/vfs_fonts');

    // Daftarkan base64 font dari vfs_fonts langsung ke objek global pdfmake printer
    PdfPrinter.vfs = pdfMakeFonts.pdfMake ? pdfMakeFonts.pdfMake.vfs : pdfMakeFonts.vfs;

    // Definisikan pemetaan font menggunakan nama file virtual yang terdaftar di VFS
    const fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };

    // Inisialisasi printer server-side dengan VFS tanpa membaca physical directory node_modules
    this.printer = new PdfPrinter(fonts);
  }

  async generateMedicationReport(data: PatientReportData): Promise<Buffer> {
    const { patient, assignedDoctor, summary, consumptions, filter, generatedAt } = data;

    // Format tanggal Indonesia
    const formatDate = (date: Date | string | undefined): string => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    };

    const formatDateTime = (date: Date | string | undefined): string => {
      if (!date) return '-';
      return new Date(date).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // Header periode filter
    const periodText =
      filter.startDate || filter.endDate
        ? `${formatDate(filter.startDate)} – ${formatDate(filter.endDate)}`
        : 'Semua Waktu';

    // Baris tabel konsumsi
    const tableRows: any[][] = [
      // Header tabel
      [
        { text: 'No', style: 'tableHeader', alignment: 'center' },
        { text: 'Nama Obat', style: 'tableHeader' },
        { text: 'Dosis', style: 'tableHeader', alignment: 'center' },
        { text: 'Jadwal', style: 'tableHeader', alignment: 'center' },
        { text: 'Dikonsumsi', style: 'tableHeader', alignment: 'center' },
        { text: 'Status', style: 'tableHeader', alignment: 'center' },
        { text: 'Keterangan', style: 'tableHeader' },
      ],
    ];

    consumptions.forEach((c, idx) => {
      const statusColor = STATUS_COLORS[c.verificationStatus];
      const statusLabel = STATUS_LABELS[c.verificationStatus];

      let keterangan = '-';
      if (c.verificationStatus === 'REJECTED' && c.rejectionReason) {
        keterangan = `Ditolak: ${c.rejectionReason}`;
      } else if (c.verificationStatus === 'APPROVED' && c.verifiedByName) {
        keterangan = `Oleh: dr. ${c.verifiedByName}`;
      }

      tableRows.push([
        { text: (idx + 1).toString(), alignment: 'center', style: 'tableCell' },
        { text: c.medicineName, style: 'tableCell' },
        { text: c.dose, alignment: 'center', style: 'tableCell' },
        { text: c.scheduledTime, alignment: 'center', style: 'tableCell' },
        { text: formatDateTime(c.consumedAt), alignment: 'center', style: 'tableCell', fontSize: 8 },
        {
          text: statusLabel,
          alignment: 'center',
          style: 'tableCell',
          color: statusColor,
          bold: true,
          fontSize: 8,
        },
        { text: keterangan, style: 'tableCell', fontSize: 8, color: '#5F5E5A' },
      ]);
    });

    // Kalau tidak ada data
    if (consumptions.length === 0) {
      tableRows.push([
        {
          text: 'Tidak ada data konsumsi pada periode ini.',
          colSpan: 7,
          alignment: 'center',
          style: 'tableCell',
          color: '#888780',
          italics: true,
        },
        {}, {}, {}, {}, {}, {},
      ]);
    }

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],

      header: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            text: 'SISTEM MONITORING OBAT',
            style: 'headerApp',
            margin: [40, 20, 0, 0],
          },
          {
            text: `Halaman ${currentPage} dari ${pageCount}`,
            alignment: 'right',
            style: 'headerPage',
            margin: [0, 20, 40, 0],
          },
        ],
      }),

      footer: () => ({
        columns: [
          {
            text: `Digenerate pada: ${formatDateTime(generatedAt)}`,
            style: 'footerText',
            margin: [40, 0, 0, 0],
          },
          {
            text: 'Dokumen ini digenerate secara otomatis oleh sistem.',
            alignment: 'right',
            style: 'footerText',
            margin: [0, 0, 40, 0],
          },
        ],
      }),

      content: [
        // ===== JUDUL LAPORAN =====
        {
          canvas: [
            {
              type: 'rect',
              x: 0, y: 0,
              w: 515, h: 70,
              r: 8,
              color: '#185FA5',
            },
          ],
        },
        {
          stack: [
            {
              text: 'LAPORAN RIWAYAT KONSUMSI OBAT',
              style: 'reportTitle',
              margin: [0, -55, 0, 0],
            },
            {
              text: `Periode: ${periodText}`,
              style: 'reportSubtitle',
            },
          ],
          margin: [16, 0, 0, 20],
        },

        // ===== INFORMASI PASIEN =====
        {
          text: 'Informasi Pasien',
          style: 'sectionTitle',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            widths: [130, '*', 130, '*'],
            body: [
              [
                { text: 'Nama Lengkap', style: 'infoLabel' },
                { text: patient.fullName, style: 'infoValue' },
                { text: 'Username', style: 'infoLabel' },
                { text: `@${patient.username}`, style: 'infoValue' },
              ],
              [
                { text: 'Email', style: 'infoLabel' },
                { text: patient.email, style: 'infoValue' },
                { text: 'Usia', style: 'infoLabel' },
                { text: `${patient.age} tahun`, style: 'infoValue' },
              ],
              [
                { text: 'No. WhatsApp', style: 'infoLabel' },
                { text: patient.whatsappNumber, style: 'infoValue' },
                { text: 'Diagnosis Utama', style: 'infoLabel' },
                { text: patient.mainDisease, style: 'infoValue' },
              ],
              [
                { text: 'Dokter Penanganan', style: 'infoLabel' },
                {
                  text: assignedDoctor
                    ? `dr. ${assignedDoctor.username} (${assignedDoctor.email})`
                    : 'Belum ditentukan',
                  style: 'infoValue',
                  colSpan: 3,
                },
                {}, {},
              ],
            ],
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex % 2 === 0 ? '#F1EFE8' : null),
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#D3D1C7',
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
          margin: [0, 0, 0, 20],
        },

        // ===== RINGKASAN STATISTIK =====
        {
          text: 'Ringkasan Statistik',
          style: 'sectionTitle',
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            this.buildStatCard('Total Konsumsi', summary.total.toString(), '#185FA5', '#E6F1FB'),
            this.buildStatCard('Disetujui', summary.approved.toString(), '#3B6D11', '#EAF3DE'),
            this.buildStatCard('Ditolak', summary.rejected.toString(), '#A32D2D', '#FCEBEB'),
            this.buildStatCard('Terlewat', summary.missed.toString(), '#534AB7', '#EEEDFE'),
            this.buildStatCard(
              'Tingkat Kepatuhan',
              `${summary.complianceRate}%`,
              summary.complianceRate >= 80 ? '#3B6D11' : summary.complianceRate >= 60 ? '#BA7517' : '#A32D2D',
              summary.complianceRate >= 80 ? '#EAF3DE' : summary.complianceRate >= 60 ? '#FAEEDA' : '#FCEBEB',
            ),
          ],
          columnGap: 8,
          margin: [0, 0, 0, 20],
        },

        // ===== TABEL RIWAYAT =====
        {
          text: 'Detail Riwayat Konsumsi',
          style: 'sectionTitle',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: [18, '*', 40, 35, 60, 60, '*'],
            body: tableRows,
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0) return '#185FA5';
              return rowIndex % 2 === 0 ? '#F1EFE8' : null;
            },
            hLineWidth: (i: number, node: any) => {
              if (i === 0 || i === 1 || i === node.table.body.length) return 1;
              return 0.5;
            },
            vLineWidth: () => 0,
            hLineColor: (i: number) => (i === 0 || i === 1 ? '#0C447C' : '#D3D1C7'),
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
        },

        // ===== CATATAN KAKI LAPORAN =====
        {
          text: [
            { text: 'Keterangan Status: ', bold: true },
            { text: 'Disetujui ', color: '#3B6D11', bold: true },
            { text: '= terverifikasi oleh dokter; ' },
            { text: 'Ditolak ', color: '#A32D2D', bold: true },
            { text: '= tidak diterima oleh dokter; ' },
            { text: 'Terlewat ', color: '#534AB7', bold: true },
            { text: '= jadwal tidak dikonsumsi.' },
          ],
          style: 'noteText',
          margin: [0, 12, 0, 0],
        },
      ],

      styles: this.getStyles(),
      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
        color: '#2C2C2A',
      },
    };

    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);

        pdfDoc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private buildStatCard(
    label: string,
    value: string,
    textColor: string,
    bgColor: string,
  ): any {
    return {
      width: '*',
      stack: [
        {
          canvas: [
            {
              type: 'rect',
              x: 0, y: 0,
              w: 90, h: 55,
              r: 6,
              color: bgColor,
            },
          ],
        },
        {
          stack: [
            {
              text: value,
              fontSize: 20,
              bold: true,
              color: textColor,
              alignment: 'center',
              margin: [0, -44, 0, 2],
            },
            {
              text: label,
              fontSize: 7.5,
              color: textColor,
              alignment: 'center',
            },
          ],
        },
      ],
    };
  }

  private getStyles(): StyleDictionary {
    return {
      headerApp: {
        fontSize: 9,
        bold: true,
        color: '#5F5E5A',
      },
      headerPage: {
        fontSize: 8,
        color: '#888780',
      },
      footerText: {
        fontSize: 7.5,
        color: '#888780',
      },
      reportTitle: {
        fontSize: 16,
        bold: true,
        color: '#ffffff',
        alignment: 'center',
      },
      reportSubtitle: {
        fontSize: 9,
        color: '#B5D4F4',
        alignment: 'center',
        margin: [0, 4, 0, 0],
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        color: '#185FA5',
        decoration: 'underline',
        decorationColor: '#B5D4F4',
      },
      infoLabel: {
        fontSize: 8.5,
        bold: true,
        color: '#444441',
      },
      infoValue: {
        fontSize: 8.5,
        color: '#2C2C2A',
      },
      tableHeader: {
        fontSize: 8.5,
        bold: true,
        color: '#ffffff',
      },
      tableCell: {
        fontSize: 8.5,
        color: '#2C2C2A',
      },
      noteText: {
        fontSize: 7.5,
        color: '#888780',
        italics: true,
      },
    };
  }
}