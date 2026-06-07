import { NextRequest, NextResponse } from "next/server";
import { getTaskRows, updateTaskCells } from "@/lib/google-sheets";
import { currentUser } from "@/lib/session";
import { canEditTask } from "@/lib/task-access";

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.apps.includes("task-manager")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { taskId } = await context.params;
  const task = (await getTaskRows()).find((item) => item.taskId === taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!canEditTask(user, task)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await updateTaskCells(task.rowNumber, { status: "Done", blocker: "" });
  return NextResponse.json({ success: true });
}
