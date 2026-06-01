import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.patientProfile.findMany({
      where: { deleted_at: null },
      include: {
        user: { select: { id: true, email: true, role: true, created_at: true } },
      },
    });
  }

  async findOne(id: string) {
    const patient = await this.prisma.patientProfile.findFirst({
      where: { id, deleted_at: null },
      include: {
        user: { select: { id: true, email: true, role: true, created_at: true } },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async create(dto: CreatePatientDto) {
    const exists = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);
    const baseUsername = dto.full_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    let username = baseUsername;
    let suffix = 1;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${suffix++}`;
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username,
        password: hashed,
        role: 'PATIENT',
        patientProfile: {
          create: {
            full_name: dto.full_name,
            age: dto.age,
            main_disease: dto.main_disease,
            whatsapp_number: dto.whatsapp_number,
          },
        },
      },
      include: { patientProfile: true },
    });

    const { password: _pw, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdatePatientDto) {
    const patient = await this.prisma.patientProfile.findFirst({
      where: { id, deleted_at: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    return this.prisma.patientProfile.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const patient = await this.prisma.patientProfile.findFirst({
      where: { id, deleted_at: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    await this.prisma.patientProfile.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return { message: 'Patient deleted successfully' };
  }
}
