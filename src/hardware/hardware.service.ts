import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HardwareService {
  constructor(private prisma: PrismaService) {}

  async check2Schedule() {
  return {
    dispense: true,
    schedule_id: 999,
    medicine_name: "TEST OBAT",
    dose: "1 tablet",
  };
}

  async checkSchedule() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    
    // Database format tanpa leading zero: "2:02" bukan "02:02"
    const currentTimeNoLeadingZero = `${now.getHours()}:${minutes}`;

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

    return {
      dispense: true,
      schedule_id: schedule.id,
      medicine_name: schedule.medicine.name,
      dose: schedule.dose,
    };
  }
}
