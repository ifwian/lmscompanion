// The first-run checklist on the dashboard. Pure functions over data the dashboard has already loaded:
// every query in the app filters by userId, so this file never needs the database itself.
import type { LmsConnection } from "../generated/prisma/client";
import { timeAgo } from "@/lib/ui/format";

export type OnboardingStepId = "email" | "connect" | "check";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  detail: string;
  done: boolean;
};

// Only the fields the checklist reads, so the page passes the connection it already loaded.
export type OnboardingConnection = Pick<LmsConnection, "encryptedPassword" | "status" | "baselineDone" | "lastCheckedAt">;

export function onboardingSteps(input: { emailVerifiedAt: Date | null; connection: OnboardingConnection | null }): OnboardingStep[] {
  const { emailVerifiedAt, connection } = input;
  // "Connected" means credentials are stored and the student has not disconnected on purpose.
  const connected = Boolean(connection?.encryptedPassword) && connection?.status !== "DISCONNECTED";
  // baselineDone only turns true after one whole check finished, which is exactly "the first sync ran".
  const checkedOnce = Boolean(connection?.baselineDone);

  return [
    {
      id: "email",
      label: "Confirm email",
      done: Boolean(emailVerifiedAt),
      detail: emailVerifiedAt
        ? "Confirmed. Notifications will reach this address."
        : "Open the link we sent when you signed up. Alerts stay off until you do.",
    },
    {
      id: "connect",
      label: "Connect e-GURO",
      done: connected,
      detail: connected
        ? "Connected. Your e-GURO password is stored encrypted."
        : "Add your CCC e-GURO login in Settings so the app can watch it for new work.",
    },
    {
      id: "check",
      label: "Check now",
      done: checkedOnce,
      detail: checkedOnce
        ? `First check finished ${timeAgo(connection?.lastCheckedAt).toLowerCase()}. New work shows up after each check.`
        : "Load your pending activities and unread lessons once, so the app has a starting point.",
    },
  ];
}

// The card only earns its space while something is left to do; once all three are done it is hidden.
export function isOnboardingComplete(steps: OnboardingStep[]): boolean {
  return steps.every((step) => step.done);
}