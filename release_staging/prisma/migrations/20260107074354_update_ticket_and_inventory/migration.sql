/*
  Warnings:

  - You are about to drop the column `attachments` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `contact_details` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `employee_name` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Ticket` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "office_location" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InventoryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "office" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generated_id" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "computer_name" TEXT,
    "ip_address" TEXT,
    "department" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "office" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SUPPORT_ISSUE',
    "description" TEXT NOT NULL,
    "request_item_type" TEXT,
    "attachment_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "resolved_at" DATETIME,
    "resolved_by" TEXT,
    "responded_at" DATETIME,
    "admin_remarks" TEXT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL
);
INSERT INTO "new_Ticket" ("admin_remarks", "created", "department", "description", "full_name", "generated_id", "id", "office", "priority", "requester_email", "status", "updated") SELECT "admin_remarks", "created", "department", "description", "full_name", "generated_id", "id", "office", "priority", "requester_email", "status", "updated" FROM "Ticket";
DROP TABLE "Ticket";
ALTER TABLE "new_Ticket" RENAME TO "Ticket";
CREATE UNIQUE INDEX "Ticket_generated_id_key" ON "Ticket"("generated_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
