import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailVerificationService } from './email-verification.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private emailVerification: EmailVerificationService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);

    const usernameTaken = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (usernameTaken) throw new ConflictException('Username already taken');

    // Validate doctorId if provided (only for PATIENT role)
    let assignedDoctorId: string | null = null;
    if (dto.role === Role.PATIENT) {
      if (dto.doctorId) {
        const doctor = await this.prisma.user.findUnique({
          where: { id: dto.doctorId },
        });
        if (!doctor) throw new BadRequestException('Doctor not found');
        if (doctor.role !== Role.DOCTOR) throw new BadRequestException('Selected user is not a doctor');
        assignedDoctorId = dto.doctorId;
      }
    }

    const user = await this.prisma.user.create({
      data: { email: dto.email, username: dto.username, password: hashed, role: dto.role },
    });

    // If PATIENT, auto-assign doctor to themselves if they're registering as doctor
    // If DOCTOR, create patient profile with themselves as assigned doctor
    if (dto.role === Role.PATIENT) {
      await this.prisma.patientProfile.create({
        data: {
          user_id: user.id,
          assigned_doctor_id: assignedDoctorId,
          full_name: '',
          age: 0,
          main_disease: '',
          whatsapp_number: '',
        },
      });
    }

    await this.emailVerification.sendVerificationLink(user.email);

    const { password: _pw, ...result } = user;
    return {
      message: 'Registration successful. Please verify your email.',
      user: result,
    };
  }

  async getDoctors() {
    return this.prisma.user.findMany({
      where: { role: Role.DOCTOR },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.email_verified_at) {
      throw new ForbiddenException('Please verify your email before logging in');
    }

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { access_token: token };
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        created_at: true,
        email_verified_at: true,
        patientProfile: true,
      },
    });

    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
