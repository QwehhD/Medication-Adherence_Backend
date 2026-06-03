import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('* * * * *')
  async sendMedicationReminders() {
    // ✅ Konversi ke WIB (UTC+7) — Railway server jalan di UTC
    const wibNow  = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const hours   = wibNow.getUTCHours().toString().padStart(2, '0');
    const minutes = wibNow.getUTCMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    const schedules = await this.prisma.schedule.findMany({
      where: { time: currentTime, status: 'PENDING' },
      include: {
        patient: {
          include: { patientProfile: true },
        },
        medicine: true,
      },
    });

    for (const schedule of schedules) {
      const phone   = schedule.patient.patientProfile?.whatsapp_number ?? 'unknown';
      const name    = schedule.patient.patientProfile?.full_name ?? schedule.patient.email;
      const message = `Halo ${name}, waktunya minum obat ${schedule.medicine.name} (${schedule.dose}). Jangan lupa ya!`;

      await this.sendWhatsApp(phone, message);
    }
  }

  private async sendWhatsApp(phone: string, message: string) {
    const token = process.env.FONNTE_TOKEN ?? '';
    try {
      const form = new URLSearchParams();
      form.append('target', phone);
      form.append('message', message);

      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: token } as HeadersInit,
        body: form,
      });

      const result = await response.json();
      if (result.status) {
        this.logger.log(`[WhatsApp] Sent to ${phone}`);
      } else {
        this.logger.error(`[WhatsApp] Failed to ${phone}: ${result.reason}`);
      }
    } catch (err) {
      this.logger.error(`[WhatsApp] Error sending to ${phone}: ${(err as Error).message}`);
    }
  }
}