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

    const schedule = await this.prisma.schedule.findFirst({
      where: {
        time: currentTime,
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
