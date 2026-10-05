-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'CHECKING', 'AUTH_ERROR', 'TEMPORARY_ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('ACTIVITY', 'QUIZ', 'ASSIGNMENT', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_changed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "lms_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lms_username" TEXT NOT NULL,
    "encrypted_password" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "last_error_code" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "baseline_done" BOOLEAN NOT NULL DEFAULT false,
    "last_successful_login" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "next_check_at" TIMESTAMP(3),
    "checking_started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lms_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lms_course_id" TEXT NOT NULL,
    "course_code" TEXT,
    "course_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT,
    "lms_activity_id" TEXT,
    "lms_type" TEXT,
    "fingerprint" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "due_date" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "notification_type" "ActivityType" NOT NULL,
    "email_status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "email_sent_at" TIMESTAMP(3),
    "email_attempts" INTEGER NOT NULL DEFAULT 0,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activities_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quizzes_enabled" BOOLEAN NOT NULL DEFAULT true,
    "assignments_enabled" BOOLEAN NOT NULL DEFAULT true,
    "announcements_enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_summary_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lms_connections_user_id_key" ON "lms_connections"("user_id");

-- CreateIndex
CREATE INDEX "lms_connections_status_next_check_at_idx" ON "lms_connections"("status", "next_check_at");

-- CreateIndex
CREATE UNIQUE INDEX "courses_user_id_lms_course_id_key" ON "courses"("user_id", "lms_course_id");

-- CreateIndex
CREATE INDEX "activities_user_id_detected_at_idx" ON "activities"("user_id", "detected_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "activities_user_id_fingerprint_key" ON "activities"("user_id", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_activity_id_key" ON "notifications"("activity_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_email_status_idx" ON "notifications"("email_status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "lms_connections" ADD CONSTRAINT "lms_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
