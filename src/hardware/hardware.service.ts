import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HardwareService {
  constructor(private prisma: PrismaService) {}

  async checkSchedule() {
    const now = new Date();
    // Railway runs UTC; schedule times in DB are stored as WIB (UTC+7)
    const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const hours = wibNow.getUTCHours().toString().padStart(2, '0');
    const minutes = wibNow.getUTCMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    const currentTimeNoLeadingZero = `${wibNow.getUTCHours()}:${minutes}`;

    const schedule = await this.prisma.schedule.findFirst({
      where: {
        time: {
          in: [currentTime, currentTimeNoLeadingZero],
        },
        status: 'PENDING',
      },
      include: {
        medicine: true,
      },
    });

    if (!schedule) {
      return { dispense: false };
    }

    await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: { status: 'WAITING_VERIFICATION' },
    });

    return {
      dispense: true,
      schedule_id: schedule.id,
      medicine_name: schedule.medicine.name,
      dose: schedule.dose,
    };
  }

  async debugSchedules() {
    const now = new Date();
    const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const hours = wibNow.getUTCHours().toString().padStart(2, '0');
    const minutes = wibNow.getUTCMinutes().toString().padStart(2, '0');
    const schedules = await this.prisma.schedule.findMany({
      where: { status: 'PENDING' },
      include: { medicine: true },
    });
    return {
      server_utc: now.toISOString(),
      server_wib: `${hours}:${minutes}`,
      looking_for: [`${hours}:${minutes}`, `${wibNow.getUTCHours()}:${minutes}`],
      schedules,
    };
  }
}
