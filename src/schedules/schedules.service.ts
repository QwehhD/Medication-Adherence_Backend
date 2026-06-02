import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

  async findAll(doctorId: string) {
    return this.prisma.schedule.findMany({
      where: { doctor_id: doctorId },
      orderBy: { created_at: 'desc' },
      include: {
        patient: { select: { id: true, email: true, patientProfile: true } },
        medicine: true,
        doctor: { select: { id: true, email: true } },
      },
    });
  }

  async findOne(id: string, doctorId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, email: true, patientProfile: true } },
        medicine: true,
        doctor: { select: { id: true, email: true } },
        consumptions: true,
      },
    });

    if (!schedule) throw new NotFoundException('Schedule not found');

    if (schedule.doctor_id !== doctorId) {
      throw new ForbiddenException('Access denied');
    }

    return schedule;
  }

  async create(doctorId: string, dto: CreateScheduleDto) {
    const patient = await this.prisma.user.findUnique({
      where: { id: dto.patient_id },
    });
    if (!patient) throw new NotFoundException(`Patient with id ${dto.patient_id} not found`);

    const medicine = await this.prisma.medicine.findUnique({
      where: { id: dto.medicine_id },
    });
    if (!medicine) throw new NotFoundException(`Medicine with id ${dto.medicine_id} not found`);

    const records = await this.prisma.$transaction(
      dto.times.map((time) =>
        this.prisma.schedule.create({
          data: {
            doctor_id: doctorId,
            patient_id: dto.patient_id,
            medicine_id: dto.medicine_id,
            dose: dto.dose,
            time,
            status: 'PENDING',
          },
        }),
      ),
    );

    return records;
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException('Schedule not found');

    if (dto.medicine_id) {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: dto.medicine_id },
      });
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

    await this.prisma.medicationConsumption.deleteMany({
      where: { schedule_id: id },
    });
    await this.prisma.schedule.delete({ where: { id } });

    return { message: 'Schedule deleted successfully' };
  }
}