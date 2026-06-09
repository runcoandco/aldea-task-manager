import { NextRequest, NextResponse } from "next/server";
import { deleteTaskRow, getTaskRows, updateTaskCells } from "@/lib/google-sheets";
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

  const { taskId } = await context.params;
  const task = (await getTaskRows()).find((item) => item.taskId === taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!canEditTask(user, task)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as {
    task?: string;
    owner?: string;
    area?: string;
    priority?: string;
    status?: string;
    dueDate?: string;
    blocker?: string;
    nextAction?: string;
    link?: string;
    notes?: string;
  };

  if (body.priority && !SETUP.priorities.includes(body.priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  if (body.status && !SETUP.statuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const nextStatus = body.status ?? task.status;
  const nextBlocker = nextStatus === "Blocked" ? (body.blocker ?? task.blocker) : "";
  const nextOwner = body.owner ?? task.owner;
  const ownerChanged = nextOwner.trim() !== task.owner.trim();

  await updateTaskCells(task.rowNumber, {
    task: body.task ?? task.task,
    owner: nextOwner,
    area: body.area ?? task.area,
    priority: body.priority ?? task.priority,
    status: nextStatus,
    dueDate: body.dueDate ?? task.dueDate,
    blocker: nextBlocker,
    nextAction: body.nextAction ?? task.nextAction,
    link: body.link ?? task.link,
    notes: body.notes ?? task.notes,
    assignedBy: ownerChanged ? user.owner : task.assignedBy
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
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

  await deleteTaskRow(task.rowNumber);
  return NextResponse.json({ success: true });
}
