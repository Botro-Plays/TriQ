-- AlterTable: make passengerId optional, add driverId to Tip
ALTER TABLE "Tip" ALTER COLUMN "passengerId" DROP NOT NULL;
ALTER TABLE "Tip" ADD COLUMN IF NOT EXISTS "driverId" TEXT;

-- AddForeignKey: driverId -> Driver
DO $$ BEGIN
  ALTER TABLE "Tip" ADD CONSTRAINT "Tip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
