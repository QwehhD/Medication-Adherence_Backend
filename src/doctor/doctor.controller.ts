import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { RejectConsumptionDto } from './dto/reject-consumption.dto';
import { DoctorService } from './doctor.service';

@ApiTags('Doctor - Verifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
@Controller('doctor')
export class DoctorController {
  constructor(private doctorService: DoctorService) {}

  @ApiOperation({ summary: 'Get all consumptions waiting verification (Doctor only)' })
  @ApiResponse({ status: 200, description: 'List of consumptions with WAITING_VERIFICATION status' })
  @Get('verifications')
  getWaitingVerifications(@Request() req: any) {
    return this.doctorService.getWaitingVerifications(req.user.id);
  }

  @ApiOperation({ summary: 'Approve a medication consumption (Doctor only)' })
  @ApiResponse({ status: 200, description: 'Consumption approved successfully' })
  @ApiResponse({ status: 404, description: 'Consumption not found' })
  @Patch('consumptions/:id/approve')
  approve(@Param('id') id: string, @Request() req: any) {
    return this.doctorService.approveConsumption(id, req.user.id);
  }

  @ApiOperation({ summary: 'Reject a medication consumption (Doctor only)' })
  @ApiResponse({ status: 200, description: 'Consumption rejected successfully' })
  @ApiResponse({ status: 404, description: 'Consumption not found' })
  @Patch('consumptions/:id/reject')
  reject(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: RejectConsumptionDto,
  ) {
    return this.doctorService.rejectConsumption(id, req.user.id, dto);
  }
}