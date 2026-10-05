-- DropIndex
DROP INDEX "notifications_email_status_idx";

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "source_task_id" TEXT;

-- AlterTable
ALTER TABLE "lms_connections" ADD COLUMN     "last_task_id" TEXT,
ADD COLUMN     "session_token" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "max_retries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "session_token" TEXT;

-- CreateTable
CREATE TABLE "lms_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "items_new" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "items_failed" INTEGER NOT NULL DEFAULT 0,
    "github_run_id" TEXT,
    "last_activity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lms_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lms_tasks_user_id_status_idx" ON "lms_tasks"("user_id", "status");

-- CreateIndex
CREATE INDEX "lms_tasks_status_started_at_idx" ON "lms_tasks"("status", "started_at");

-- CreateIndex
CREATE INDEX "notifications_email_status_retry_count_idx" ON "notifications"("email_status", "retry_count");

-- AddForeignKey
ALTER TABLE "lms_tasks" ADD CONSTRAINT "lms_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
