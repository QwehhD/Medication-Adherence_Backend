import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HardwareService {
  constructor(private prisma: PrismaService) {}

  async checkSchedule() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    
    // Also check previous minute window to account for ESP timing delays
    const prevMinute = new Date(now.getTime() - 60000);
    const prevHours = prevMinute.getHours().toString().padStart(2, '0');
    const prevMinutes = prevMinute.getMinutes().toString().padStart(2, '0');
    const prevTime = `${prevHours}:${prevMinutes}`;

    const schedule = await this.prisma.schedule.findFirst({
      where: {
        time: {
          in: [currentTime, prevTime],
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

    return {
      dispense: true,
      schedule_id: schedule.id,
      medicine_name: schedule.medicine.name,
      dose: schedule.dose,
    };
  }
}
