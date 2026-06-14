import { redirect } from "next/navigation";
import TaskDashboard from "@/components/task-dashboard";
import { getSetupOwners, getTaskRows } from "@/lib/google-sheets";
import { currentUser } from "@/lib/session";
import { canSeeTask } from "@/lib/task-access";
import { buildSections, splitDuplicateTasks } from "@/lib/tasks";

export default async function TaskManagerPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/");
  }

  if (!user.apps.includes("task-manager")) {
    redirect("/");
  }

  const [tasks, owners] = await Promise.all([getTaskRows(), getSetupOwners()]);
  const visibleTasks = tasks.filter((task) => canSeeTask(user, task));
  const { unique: uniqueVisibleTasks, duplicates } = splitDuplicateTasks(visibleTasks);
  const duplicateTaskIds = [...new Set(duplicates.map((task) => task.taskId))];

  return (
    <TaskDashboard
      user={user}
      sections={buildSections(uniqueVisibleTasks)}
      owners={owners}
      allTasks={uniqueVisibleTasks}
      duplicateTaskIds={duplicateTaskIds}
      signalUrl="/api/signal/launch"
    />
  );
}
