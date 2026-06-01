-- DropForeignKey
ALTER TABLE "MedicationConsumption" DROP CONSTRAINT "MedicationConsumption_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "MedicationConsumption" DROP CONSTRAINT "MedicationConsumption_schedule_id_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_medicine_id_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_patient_id_fkey";

-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationConsumption" ADD CONSTRAINT "MedicationConsumption_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationConsumption" ADD CONSTRAINT "MedicationConsumption_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
