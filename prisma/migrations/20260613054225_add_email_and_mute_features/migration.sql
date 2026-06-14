
ALTER TABLE "Monitor" ADD COLUMN     "lastNotificationaAt" TIMESTAMP(3),
ADD COLUMN     "notifyEmail" TEXT;

ALTER TABLE "User" ADD COLUMN     "alertsMutedUntil" TIMESTAMP(3);

CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "stateSent" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);


CREATE INDEX "NotificationLog_monitorId_idx" ON "NotificationLog"("monitorId");


ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
