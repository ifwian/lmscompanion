import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import type { OnboardingStep } from "@/lib/onboarding";

function actionFor(step: OnboardingStep) {
  if (step.done) return null;
  if (step.id === "connect") return <Link href="/settings#lms">Connect e-GURO</Link>;
  if (step.id === "check") return <ActionButton url="/api/lms/check-now" label="Check now" busyLabel="Checking…" />;
  return null; // the email banner in the signed-in layout already offers "Send the link again"
}

// First-run checklist for a new student. Renders nothing once every step is done, so a returning
// student never sees it again.
export default function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;

  return (
    <section className="pending onboarding" aria-labelledby="onboarding-title">
      <div className="pending-head">
        <div>
          <p className="label">Getting started</p>
          <h2 id="onboarding-title" className="pending-title">Finish setting up</h2>
        </div>
        <p className="hint">{done} of {steps.length} done</p>
      </div>
      <ol className="list onboarding-list">
        {steps.map((step) => (
          <li className="item onboarding-item" key={step.id} data-done={step.done}>
            <span className="onboarding-mark" aria-hidden="true">{step.done ? "✓" : ""}</span>
            <div className="item-main">
              <p className="item-title onboarding-step">
                {step.label}
                <span className="visually-hidden">{step.done ? " — done" : " — still to do"}</span>
              </p>
              <p className="item-meta">{step.detail}</p>
            </div>
            <div className="onboarding-action">{actionFor(step)}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}