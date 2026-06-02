import { BadRequestException, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { CloudinaryService } from '../common/cloudinary.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|jpg)$/)) {
          return cb(new BadRequestException('Only jpg/png images are allowed'), false);
        }
        cb(null, true);
      },
    }),
  ],
  controllers: [PatientController],
  providers: [PatientService, CloudinaryService],
})
export class PatientModule {}
