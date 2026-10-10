import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import TaskForm from "@/components/TaskForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New task · e-GURO Companion" };

export default async function NewTaskPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <p className="eyebrow">Tasks</p>
      <h1 className="page-title">New task</h1>
      <TaskForm />
    </>
  );
}