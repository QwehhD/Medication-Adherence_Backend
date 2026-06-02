import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterPatientDto } from './register-patient.dto';

describe('RegisterPatientDto', () => {
  it('should validate a valid patient registration', async () => {
    const dto = plainToInstance(RegisterPatientDto, {
      email: 'patient@example.com',
      password: 'password123',
      full_name: 'Jane Doe',
      age: 28,
      main_disease: 'Hypertension',
      whatsapp_number: '081234567892',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation with invalid email', async () => {
    const dto = plainToInstance(RegisterPatientDto, {
      email: 'invalid-email',
      password: 'password123',
      full_name: 'Jane Doe',
      age: 28,
      main_disease: 'Hypertension',
      whatsapp_number: '081234567892',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept optional doctorId', async () => {
    const dto = plainToInstance(RegisterPatientDto, {
      email: 'patient@example.com',
      password: 'password123',
      full_name: 'Jane Doe',
      age: 28,
      main_disease: 'Hypertension',
      whatsapp_number: '081234567892',
      doctorId: '550e8400-e29b-41d4-a716-446655440000',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
