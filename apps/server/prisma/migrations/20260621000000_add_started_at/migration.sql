-- Add startedAt column to Ride table for ETA calculation
ALTER TABLE "Ride" ADD COLUMN "startedAt" TIMESTAMP(3);
