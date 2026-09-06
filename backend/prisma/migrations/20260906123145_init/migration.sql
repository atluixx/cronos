-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WhatsAppSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_LINK',
    "authState" JSONB,
    "lastConnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "whatsappGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "cachedMetadata" JSONB NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Group_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "text" TEXT,
    "mediaPath" TEXT,
    "mediaType" TEXT,
    "recurrence" TEXT,
    "sendAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "bullJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduledMessageId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "MessageTarget_scheduledMessageId_fkey" FOREIGN KEY ("scheduledMessageId") REFERENCES "ScheduledMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageTarget_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SendLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduledMessageId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    CONSTRAINT "SendLog_scheduledMessageId_fkey" FOREIGN KEY ("scheduledMessageId") REFERENCES "ScheduledMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WhatsAppSession_userId_idx" ON "WhatsAppSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_sessionId_whatsappGroupId_key" ON "Group"("sessionId", "whatsappGroupId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_userId_idx" ON "ScheduledMessage"("userId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_sessionId_idx" ON "ScheduledMessage"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTarget_scheduledMessageId_groupId_key" ON "MessageTarget"("scheduledMessageId", "groupId");

-- CreateIndex
CREATE INDEX "SendLog_scheduledMessageId_idx" ON "SendLog"("scheduledMessageId");
