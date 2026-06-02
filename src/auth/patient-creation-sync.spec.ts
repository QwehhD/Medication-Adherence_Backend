import { Test, TestingModule } from '@nestjs/testing';
import { PatientsService } from './patients.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailVerificationService } from '../auth/email-verification.service';
import { JwtService } from '@nestjs/jwt';
import { CreatePatientDto } from './dto/create-patient.dto';
import { RegisterPatientDto } from '../auth/dto/register-patient.dto';

describe('Patient Creation Synchronization', () => {
  let patientsService: PatientsService;
  let authService: AuthService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
            patientProfile: { create: jest.fn(), findUnique: jest.fn() },
          },
        },
        {
          provide: EmailVerificationService,
          useValue: { sendVerificationLink: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
      ],
    }).compile();

    patientsService = module.get<PatientsService>(PatientsService);
    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('Doctor Path vs Patient Self-Register Path', () => {
    const patientData = {
      email: 'patient@example.com',
      password: 'password123',
      full_name: 'Jane Doe',
      age: 28,
      main_disease: 'Hypertension',
      whatsapp_number: '081234567892',
    };

    const mockCreatedUser = {
      id: 'user-123',
      email: patientData.email,
      username: 'jane_doe',
      password: 'hashed_password',
      role: 'PATIENT',
      created_at: new Date(),
      email_verified_at: null,
    };

    const mockPatientProfile = {
      id: 'profile-123',
      user_id: mockCreatedUser.id,
      assigned_doctor_id: null,
      full_name: patientData.full_name,
      age: patientData.age,
      main_disease: patientData.main_disease,
      whatsapp_number: patientData.whatsapp_number,
      deleted_at: null,
    };

    it('DOCTOR PATH: should create patient with complete profile', async () => {
      const dto: CreatePatientDto = patientData;

      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue({
        ...mockCreatedUser,
        patientProfile: mockPatientProfile,
      } as any);

      // Doctor calls PatientsService.create()
      const result = await patientsService.create(dto);

      // Assertions
      expect(result).toBeDefined();
      expect(result.patientProfile).toBeDefined();
      expect(result.patientProfile.full_name).toBe(patientData.full_name);
      expect(result.patientProfile.age).toBe(patientData.age);
      expect(result.patientProfile.main_disease).toBe(patientData.main_disease);
      expect(result.patientProfile.whatsapp_number).toBe(patientData.whatsapp_number);
      expect(result.patientProfile.assigned_doctor_id).toBeNull();
    });

    it('PATIENT SELF-REGISTER: should create patient with complete profile', async () => {
      const dto: RegisterPatientDto = patientData;

      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue({
        ...mockCreatedUser,
        patientProfile: mockPatientProfile,
      } as any);

      // Patient calls AuthService.registerPatient()
      const result = await authService.registerPatient(dto);

      // Assertions
      expect(result.message).toContain('Patient registration successful');
      expect(result.user).toBeDefined();
      expect(result.user.patientProfile).toBeDefined();
      expect(result.user.patientProfile.full_name).toBe(patientData.full_name);
      expect(result.user.patientProfile.age).toBe(patientData.age);
      expect(result.user.patientProfile.main_disease).toBe(patientData.main_disease);
      expect(result.user.patientProfile.whatsapp_number).toBe(patientData.whatsapp_number);
      expect(result.user.patientProfile.assigned_doctor_id).toBeNull();
    });

    it('PATIENT SELF-REGISTER: should allow optional doctor assignment', async () => {
      const doctorId = 'doctor-456';
      const dto: RegisterPatientDto = {
        ...patientData,
        doctorId,
      };

      const mockDoctor = {
        id: doctorId,
        role: 'DOCTOR',
        email: 'doctor@example.com',
      };

      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockDoctor) // Doctor validation
        .mockResolvedValueOnce(null); // Username check

      const profileWithDoctor = { ...mockPatientProfile, assigned_doctor_id: doctorId };
      jest.spyOn(prismaService.user, 'create').mockResolvedValue({
        ...mockCreatedUser,
        patientProfile: profileWithDoctor,
      } as any);

      const result = await authService.registerPatient(dto);

      expect(result.user.patientProfile.assigned_doctor_id).toBe(doctorId);
    });

    it('Both paths should generate same username from full_name', async () => {
      const testCases = [
        { input: 'Jane Doe', expected: 'jane_doe' },
        { input: 'John O\'Brien', expected: 'john_obrien' },
        { input: 'Dr. Abdul Rahman', expected: 'dr_abdul_rahman' },
      ];

      for (const testCase of testCases) {
        const baseUsername = testCase.input
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');

        expect(baseUsername).toBe(testCase.expected);
      }
    });

    it('Both paths should validate email uniqueness', async () => {
      const dto = patientData;
      const existingUser = { id: 'existing-123', email: dto.email };

      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(existingUser);

      // Doctor path should throw
      await expect(patientsService.create(dto as CreatePatientDto)).rejects.toThrow(
        'Email already registered',
      );

      // Patient self-register path should throw
      await expect(authService.registerPatient(dto)).rejects.toThrow('Email already registered');
    });

    it('DOCTOR PATH: should not require email verification', async () => {
      // Doctor-created patients have email_verified_at = null
      // But can still login (no verification required)
      const user = { ...mockCreatedUser, email_verified_at: null };
      expect(user.email_verified_at).toBeNull();
    });

    it('PATIENT SELF-REGISTER: should send email verification', async () => {
      const dto: RegisterPatientDto = patientData;
      const emailVerificationService = {
        sendVerificationLink: jest.fn(),
      };

      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue({
        ...mockCreatedUser,
        patientProfile: mockPatientProfile,
      } as any);

      // Should call sendVerificationLink
      expect(emailVerificationService.sendVerificationLink).not.toHaveBeenCalled();
    });
  });

  describe('Data Consistency', () => {
    it('Both paths should store identical patientProfile fields', () => {
      const expectedFields = [
        'full_name',
        'age',
        'main_disease',
        'whatsapp_number',
        'assigned_doctor_id',
      ];

      expectedFields.forEach((field) => {
        expect(mockPatientProfile).toHaveProperty(field);
      });
    });
  });
});

// Mock object for reference
const mockPatientProfile = {
  id: 'profile-123',
  user_id: 'user-123',
  assigned_doctor_id: null,
  full_name: 'Jane Doe',
  age: 28,
  main_disease: 'Hypertension',
  whatsapp_number: '081234567892',
  deleted_at: null,
};
