-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN "lastLowStockEmail" DATETIME;
ALTER TABLE "Inventory" ADD COLUMN "lastModifiedBy" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "reopened_at" DATETIME;

-- CreateTable
CREATE TABLE "BackupLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" TEXT,
    "path" TEXT
);
