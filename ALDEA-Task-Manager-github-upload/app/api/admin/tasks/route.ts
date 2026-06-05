import { NextRequest, NextResponse } from "next/server";
import { appendTask } from "@/lib/google-sheets";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/task-access";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  if (!body.task || !body.owner) {
    return NextResponse.json({ error: "Task and owner are required" }, { status: 400 });
  }

  await appendTask({
    task: body.task,
    owner: body.owner,
    area: body.area || "",
    priority: body.priority || "Medium",
    status: body.status || "To Do",
    dueDate: body.dueDate || "",
    blocker: body.blocker || "",
    nextAction: body.nextAction || "",
    link: body.link || "",
    notes: body.notes || ""
  });

  return NextResponse.json({ success: true });
}
