-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "whatsappGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "cachedMetadata" JSONB NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Group_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("cachedMetadata", "id", "lastSyncedAt", "name", "participantCount", "sessionId", "whatsappGroupId") SELECT "cachedMetadata", "id", "lastSyncedAt", "name", "participantCount", "sessionId", "whatsappGroupId" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE UNIQUE INDEX "Group_sessionId_whatsappGroupId_key" ON "Group"("sessionId", "whatsappGroupId");
CREATE TABLE "new_MessageTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduledMessageId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "MessageTarget_scheduledMessageId_fkey" FOREIGN KEY ("scheduledMessageId") REFERENCES "ScheduledMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageTarget_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessageTarget" ("groupId", "id", "scheduledMessageId") SELECT "groupId", "id", "scheduledMessageId" FROM "MessageTarget";
DROP TABLE "MessageTarget";
ALTER TABLE "new_MessageTarget" RENAME TO "MessageTarget";
CREATE UNIQUE INDEX "MessageTarget_scheduledMessageId_groupId_key" ON "MessageTarget"("scheduledMessageId", "groupId");
CREATE TABLE "new_ScheduledMessage" (
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
    CONSTRAINT "ScheduledMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ScheduledMessage" ("bullJobId", "createdAt", "id", "mediaPath", "mediaType", "recurrence", "sendAt", "sessionId", "status", "text", "userId") SELECT "bullJobId", "createdAt", "id", "mediaPath", "mediaType", "recurrence", "sendAt", "sessionId", "status", "text", "userId" FROM "ScheduledMessage";
DROP TABLE "ScheduledMessage";
ALTER TABLE "new_ScheduledMessage" RENAME TO "ScheduledMessage";
CREATE INDEX "ScheduledMessage_userId_idx" ON "ScheduledMessage"("userId");
CREATE INDEX "ScheduledMessage_sessionId_idx" ON "ScheduledMessage"("sessionId");
CREATE TABLE "new_SendLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduledMessageId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    CONSTRAINT "SendLog_scheduledMessageId_fkey" FOREIGN KEY ("scheduledMessageId") REFERENCES "ScheduledMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SendLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SendLog" ("attemptedAt", "errorMessage", "groupId", "id", "scheduledMessageId", "success") SELECT "attemptedAt", "errorMessage", "groupId", "id", "scheduledMessageId", "success" FROM "SendLog";
DROP TABLE "SendLog";
ALTER TABLE "new_SendLog" RENAME TO "SendLog";
CREATE INDEX "SendLog_scheduledMessageId_idx" ON "SendLog"("scheduledMessageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
