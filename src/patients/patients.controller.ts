import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('Doctor - Patients')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
@Controller('patients')
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @ApiOperation({ summary: 'Get all patients (Doctor only)' })
  @ApiResponse({ status: 200, description: 'List of all active patients' })
  @Get()
  findAll(@Request() req: any) {
    return this.patientsService.findAll(req.user.id);
  }

  @ApiOperation({ summary: 'Get patient by ID (Doctor only)' })
  @ApiResponse({ status: 200, description: 'Patient data' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.patientsService.findOne(id, req.user.id);
  }

  @ApiOperation({ summary: 'Create a new patient account (Doctor only)' })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @Post()
  create(@Request() req: any, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Update patient profile (Doctor only)' })
  @ApiResponse({ status: 200, description: 'Patient updated successfully' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Soft delete patient (Doctor only)' })
  @ApiResponse({ status: 200, description: 'Patient deleted successfully' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.patientsService.remove(id);
  }
}