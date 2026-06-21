-- CreateTable
CREATE TABLE "PassengerFeedback" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "fromDriverId" TEXT NOT NULL,
    "toPassengerId" TEXT NOT NULL,
    "thumbsUp" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassengerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PassengerFeedback_rideId_key" ON "PassengerFeedback"("rideId");

-- AddForeignKey
ALTER TABLE "PassengerFeedback" ADD CONSTRAINT "PassengerFeedback_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerFeedback" ADD CONSTRAINT "PassengerFeedback_fromDriverId_fkey" FOREIGN KEY ("fromDriverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerFeedback" ADD CONSTRAINT "PassengerFeedback_toPassengerId_fkey" FOREIGN KEY ("toPassengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
