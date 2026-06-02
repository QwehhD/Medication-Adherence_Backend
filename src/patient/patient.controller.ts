import {
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UploadConsumptionDto } from './dto/upload-consumption.dto';
import { PatientService } from './patient.service';

@ApiTags('Patient')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PATIENT)
@Controller('patient')
export class PatientController {
  constructor(private patientService: PatientService) {}

  @ApiOperation({ summary: "Get today's schedules for the logged-in patient" })
  @ApiResponse({ status: 200, description: "List of today's schedules" })
  @Get('schedules/today')
  getTodaySchedules(@Request() req: any) {
    return this.patientService.getTodaySchedules(req.user.id);
  }

  @ApiOperation({ summary: 'Upload proof of medication consumption (Patient only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['proof_image', 'schedule_id'],
      properties: {
        proof_image: { type: 'string', format: 'binary', description: 'Image file (jpg/png, max 5MB)' },
        schedule_id: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Consumption record created, schedule set to WAITING_VERIFICATION' })
  @Post('consumptions')
  @UseInterceptors(FileInterceptor('proof_image'))
  uploadConsumption(
    @Request() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadConsumptionDto,
  ) {
    return this.patientService.uploadConsumption(req.user.id, file, dto.schedule_id);
  }

  @ApiOperation({ summary: 'Get consumption history for the logged-in patient' })
  @ApiResponse({ status: 200, description: 'List of consumption records' })
  @Get('history')
  getHistory(@Request() req: any) {
    return this.patientService.getHistory(req.user.id);
  }
}
