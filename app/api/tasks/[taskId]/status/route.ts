import { NextRequest, NextResponse } from "next/server";
import { getTaskRows, updateTaskCells } from "@/lib/google-sheets";
import { currentUser } from "@/lib/session";
import { canEditTask } from "@/lib/task-access";
import { SETUP } from "@/lib/tasks";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.apps.includes("task-manager")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { status?: string };
  if (!body.status || !SETUP.statuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { taskId } = await context.params;
  const task = (await getTaskRows()).find((item) => item.taskId === taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!canEditTask(user, task)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await updateTaskCells(task.rowNumber, {
    status: body.status,
    ...(body.status !== "Blocked" ? { blocker: "" } : {})
  });
  return NextResponse.json({ success: true });
}
