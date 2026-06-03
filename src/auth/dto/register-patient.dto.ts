import { IsEmail, IsString, MinLength, IsInt, Min, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterPatientDto {
  @ApiProperty({ example: 'patient@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  full_name: string;

  @ApiProperty({ example: 28 })
  @IsInt()
  @Min(1)
  age: number;

  @ApiProperty({ example: 'Hypertension' })
  @IsString()
  main_disease: string;

  @ApiProperty({ example: '081234567892' })
  @IsString()
  whatsapp_number: string;

  @ApiProperty({ example: 'doctor-uuid', description: 'Doctor ID to assign to this patient' })
  @IsUUID()
  doctorId: string;
}