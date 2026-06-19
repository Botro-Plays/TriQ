-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `firebaseUid` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `role` ENUM('PASSENGER', 'DRIVER', 'OWNER', 'STAFF') NOT NULL DEFAULT 'PASSENGER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_firebaseUid_key`(`firebaseUid`),
    UNIQUE INDEX `User_phoneNumber_key`(`phoneNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Passenger` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `photoUrl` TEXT NULL,
    `homeLocation` TEXT NULL,
    `workLocation` TEXT NULL,
    `emergencyContact` VARCHAR(191) NULL,
    `kycStatus` ENUM('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'UNVERIFIED',
    `kycReviewedAt` DATETIME(3) NULL,
    `kycReviewedBy` VARCHAR(191) NULL,
    `kycRejectionReason` TEXT NULL,
    `trustScore` INTEGER NOT NULL DEFAULT 100,
    `autoCancelledCount` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Passenger_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Driver` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `photoUrl` TEXT NULL,
    `plateNumber` VARCHAR(191) NOT NULL,
    `tricycleModel` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `currentLat` DOUBLE NULL,
    `currentLng` DOUBLE NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `lastOnlineAt` DATETIME(3) NULL,
    `pickupRadius` DOUBLE NOT NULL DEFAULT 2.0,
    `expandedRadiusUntil` DATETIME(3) NULL,
    `totalEarnings` INTEGER NOT NULL DEFAULT 0,
    `totalRides` INTEGER NOT NULL DEFAULT 0,
    `rating` DOUBLE NOT NULL DEFAULT 5.0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `kycStatus` ENUM('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `kycReviewedAt` DATETIME(3) NULL,
    `kycReviewedBy` VARCHAR(191) NULL,
    `kycRejectionReason` TEXT NULL,
    `subscriptionTier` ENUM('FREE', 'PRO') NOT NULL DEFAULT 'FREE',
    `subscriptionStatus` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `subscriptionExpiresAt` DATETIME(3) NULL,

    UNIQUE INDEX `Driver_userId_key`(`userId`),
    UNIQUE INDEX `Driver_plateNumber_key`(`plateNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `tier` ENUM('FREE', 'PRO') NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `isTrial` BOOLEAN NOT NULL DEFAULT false,
    `trialEndsAt` DATETIME(3) NULL,
    `paymongoId` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SavedPlace` (
    `id` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `address` TEXT NOT NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ride` (
    `id` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NULL,
    `pickupLat` DOUBLE NOT NULL,
    `pickupLng` DOUBLE NOT NULL,
    `pickupAddress` TEXT NOT NULL,
    `dropoffLat` DOUBLE NOT NULL,
    `dropoffLng` DOUBLE NOT NULL,
    `dropoffAddress` TEXT NOT NULL,
    `status` ENUM('REQUESTED', 'ACCEPTED', 'COUNTER_OFFERED', 'COUNTER_OFFER_ACCEPTED', 'COUNTER_OFFER_REJECTED', 'COUNTER_OFFER_EXPIRED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `estimatedFare` INTEGER NOT NULL,
    `finalFare` INTEGER NULL,
    `passengerCount` INTEGER NOT NULL DEFAULT 1,
    `hasSeniorCitizen` BOOLEAN NOT NULL DEFAULT false,
    `hasStudent` BOOLEAN NOT NULL DEFAULT false,
    `hasExtraBaggage` BOOLEAN NOT NULL DEFAULT false,
    `counterOfferedFare` INTEGER NULL,
    `counterOfferStatus` VARCHAR(191) NULL,
    `counterOfferExpiresAt` DATETIME(3) NULL,
    `counterOfferDriverId` VARCHAR(191) NULL,
    `negotiatedFare` INTEGER NULL,
    `paymentMethod` ENUM('CASH', 'GCASH', 'MAYA', 'CARD') NOT NULL DEFAULT 'CASH',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideStatus` (
    `id` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `status` ENUM('REQUESTED', 'ACCEPTED', 'COUNTER_OFFERED', 'COUNTER_OFFER_ACCEPTED', 'COUNTER_OFFER_REJECTED', 'COUNTER_OFFER_EXPIRED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `note` VARCHAR(191) NULL,
    `actor` VARCHAR(191) NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tip` (
    `id` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `paymongoId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paidAt` DATETIME(3) NULL,

    UNIQUE INDEX `Tip_rideId_key`(`rideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `fromPassengerId` VARCHAR(191) NOT NULL,
    `toDriverId` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `thumbsUp` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Review_rideId_key`(`rideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NULL,
    `driverId` VARCHAR(191) NULL,
    `type` ENUM('GOVT_ID', 'DRIVER_LICENSE', 'FRANCHISE_PERMIT', 'OR_CR', 'PASSENGER_SELFIE') NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Badge` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `iconUrl` VARCHAR(191) NULL,
    `targetRole` ENUM('PASSENGER', 'DRIVER', 'OWNER', 'STAFF') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Badge_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriverBadge` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `awardedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DriverBadge_driverId_badgeId_key`(`driverId`, `badgeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PassengerBadge` (
    `id` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `awardedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PassengerBadge_passengerId_badgeId_key`(`passengerId`, `badgeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriverPoints` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PassengerPoints` (
    `id` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeasonalChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `targetRole` ENUM('PASSENGER', 'DRIVER', 'OWNER', 'STAFF') NOT NULL,
    `condition` VARCHAR(191) NOT NULL,
    `rewardBadgeId` VARCHAR(191) NULL,
    `rewardPoints` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `id` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `reporterRole` ENUM('PASSENGER', 'DRIVER', 'OWNER', 'STAFF') NOT NULL,
    `reportedRole` ENUM('PASSENGER', 'DRIVER', 'OWNER', 'STAFF') NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `reportedId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `resolution` TEXT NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Strike` (
    `id` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `issuedBy` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    UNIQUE INDEX `Strike_rideId_key`(`rideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `City` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `province` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FareRate` (
    `id` VARCHAR(191) NOT NULL,
    `cityId` VARCHAR(191) NOT NULL,
    `baseFare` INTEGER NOT NULL,
    `perKmRate` INTEGER NOT NULL,
    `maxDistance` INTEGER NOT NULL,
    `minDistance` INTEGER NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveUntil` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemConfig` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `SystemConfig_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmergencyEvent` (
    `id` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `responderId` VARCHAR(191) NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `alertType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Device` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NULL,
    `driverId` VARCHAR(191) NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `os` VARCHAR(191) NULL,
    `appVersion` VARCHAR(191) NULL,
    `lastSeenAt` DATETIME(3) NOT NULL,
    `isTrusted` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Device_fingerprint_key`(`fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationPreference` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NULL,
    `driverId` VARCHAR(191) NULL,
    `pushEnabled` BOOLEAN NOT NULL DEFAULT true,
    `smsEnabled` BOOLEAN NOT NULL DEFAULT true,
    `emailEnabled` BOOLEAN NOT NULL DEFAULT false,
    `marketingEnabled` BOOLEAN NOT NULL DEFAULT true,
    `rideUpdatesEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NotificationPreference_userId_key`(`userId`),
    UNIQUE INDEX `NotificationPreference_passengerId_key`(`passengerId`),
    UNIQUE INDEX `NotificationPreference_driverId_key`(`driverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Passenger` ADD CONSTRAINT `Passenger_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Driver` ADD CONSTRAINT `Driver_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavedPlace` ADD CONSTRAINT `SavedPlace_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `Passenger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ride` ADD CONSTRAINT `Ride_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `Passenger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ride` ADD CONSTRAINT `Ride_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideStatus` ADD CONSTRAINT `RideStatus_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `Ride`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tip` ADD CONSTRAINT `Tip_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `Ride`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tip` ADD CONSTRAINT `Tip_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `Passenger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `Ride`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_fromPassengerId_fkey` FOREIGN KEY (`fromPassengerId`) REFERENCES `Passenger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_toDriverId_fkey` FOREIGN KEY (`toDriverId`) REFERENCES `Driver`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `Passenger`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DriverBadge` ADD CONSTRAINT `DriverBadge_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DriverBadge` ADD CONSTRAINT `DriverBadge_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PassengerBadge` ADD CONSTRAINT `PassengerBadge_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `Passenger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PassengerBadge` ADD CONSTRAINT `PassengerBadge_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DriverPoints` ADD CONSTRAINT `DriverPoints_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PassengerPoints` ADD CONSTRAINT `PassengerPoints_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `Passenger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `Ride`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportAttachment` ADD CONSTRAINT `ReportAttachment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Strike` ADD CONSTRAINT `Strike_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `Passenger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Strike` ADD CONSTRAINT `Strike_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `Ride`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FareRate` ADD CONSTRAINT `FareRate_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `City`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmergencyEvent` ADD CONSTRAINT `EmergencyEvent_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `Ride`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `Passenger`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `Passenger`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
