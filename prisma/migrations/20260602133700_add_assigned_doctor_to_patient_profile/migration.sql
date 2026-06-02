-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN "assigned_doctor_id" TEXT;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_assigned_doctor_id_fkey" FOREIGN KEY ("assigned_doctor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
