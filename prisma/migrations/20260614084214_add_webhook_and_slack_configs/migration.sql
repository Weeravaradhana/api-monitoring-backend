-- CreateTable
CREATE TABLE "WebhookConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "secretToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "channelName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookConfig_tenantId_idx" ON "WebhookConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackConfig_tenantId_key" ON "SlackConfig"("tenantId");

-- CreateIndex
CREATE INDEX "SlackConfig_tenantId_idx" ON "SlackConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "WebhookConfig" ADD CONSTRAINT "WebhookConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackConfig" ADD CONSTRAINT "SlackConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
