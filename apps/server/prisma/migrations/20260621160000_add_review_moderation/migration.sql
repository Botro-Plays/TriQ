-- AddColumn: isHidden and hiddenReason to Review
ALTER TABLE "Review" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Review" ADD COLUMN "hiddenReason" TEXT;
