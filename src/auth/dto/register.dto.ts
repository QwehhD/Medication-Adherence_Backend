import { IsEmail, IsEnum, IsString, MinLength, IsUUID, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'doctor@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'dr_john' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: Role, example: Role.DOCTOR })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ example: 'doctor-uuid', required: false, description: 'Doctor ID — wajib jika role PATIENT' })
  @ValidateIf((o) => o.role === Role.PATIENT)
  @IsUUID()
  doctorId?: string;
}