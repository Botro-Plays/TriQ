-- Add fcmToken to Passenger and Driver for push notifications
ALTER TABLE "Passenger" ADD COLUMN "fcmToken" TEXT;
ALTER TABLE "Driver" ADD COLUMN "fcmToken" TEXT;

INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count")
VALUES (gen_random_uuid(),'','NOW()','20260621220000_add_fcm_tokens',NULL,NULL,'NOW()',1);
