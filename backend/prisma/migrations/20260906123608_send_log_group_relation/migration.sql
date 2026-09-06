-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SendLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduledMessageId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    CONSTRAINT "SendLog_scheduledMessageId_fkey" FOREIGN KEY ("scheduledMessageId") REFERENCES "ScheduledMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SendLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SendLog" ("attemptedAt", "errorMessage", "groupId", "id", "scheduledMessageId", "success") SELECT "attemptedAt", "errorMessage", "groupId", "id", "scheduledMessageId", "success" FROM "SendLog";
DROP TABLE "SendLog";
ALTER TABLE "new_SendLog" RENAME TO "SendLog";
CREATE INDEX "SendLog_scheduledMessageId_idx" ON "SendLog"("scheduledMessageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
