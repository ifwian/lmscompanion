-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "is_material" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_unread" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_seen_at" TIMESTAMP(3),
ADD COLUMN     "lms_status" TEXT;

-- CreateIndex
CREATE INDEX "activities_user_id_lms_status_idx" ON "activities"("user_id", "lms_status");
