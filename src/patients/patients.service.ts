import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailVerificationService } from '../auth/email-verification.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private prisma: PrismaService,
    private emailVerification: EmailVerificationService,
  ) {}

  findAll(doctorId: string) {
    return this.prisma.patientProfile.findMany({
      where: {
        assigned_doctor_id: doctorId,
        deleted_at: null,
      },
      include: {
        user: { select: { id: true, email: true, role: true, created_at: true } },
      },
    });
  }

  async findOne(id: string, doctorId: string) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true, created_at: true } },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    if (patient.assigned_doctor_id !== doctorId) {
      throw new ForbiddenException('Access denied');
    }
    return patient;
  }

  async create(dto: CreatePatientDto, doctorId: string) {
    const exists = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);
    const baseUsername = dto.full_name
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
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
            assigned_doctor_id: doctorId,
          },
        },
      },
      include: { patientProfile: true },
    });

    try {
      await this.emailVerification.sendVerificationLink(user.email);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${user.email}: ${error instanceof Error ? error.message : error}`,
      );
    }

    const { password: _pw, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdatePatientDto) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    return this.prisma.patientProfile.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    await this.prisma.user.delete({
      where: { id: patient.user_id },
    });
    return { message: 'Patient deleted successfully' };
  }
}