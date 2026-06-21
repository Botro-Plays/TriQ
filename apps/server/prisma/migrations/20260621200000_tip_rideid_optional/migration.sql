-- AlterTable: make rideId optional on Tip (allows standalone tips without a ride)
ALTER TABLE "Tip" ALTER COLUMN "rideId" DROP NOT NULL;
