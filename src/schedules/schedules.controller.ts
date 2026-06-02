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
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('Doctor - Schedules')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
@Controller('schedules')
export class SchedulesController {
  constructor(private schedulesService: SchedulesService) {}

  @ApiOperation({ summary: 'Get all schedules with full info (Doctor only)' })
  @ApiResponse({ status: 200, description: 'List of schedules' })
  @Get()
  findAll(@Request() req: any) {
    return this.schedulesService.findAll(req.user.id);
  }

  @ApiOperation({ summary: 'Get schedule by ID with full info (Doctor only)' })
  @ApiResponse({ status: 200, description: 'Schedule detail' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.schedulesService.findOne(id, req.user.id);
  }

  @ApiOperation({ summary: 'Create schedules for a patient (Doctor only)' })
  @ApiResponse({ status: 201, description: 'Schedules created successfully' })
  @Post()
  create(@Request() req: any, @Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Update schedule (Doctor only)' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.schedulesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete schedule (Doctor only)' })
  @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schedulesService.remove(id);
  }
}