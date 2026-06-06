import { NextRequest, NextResponse } from "next/server";
import { appendTask } from "@/lib/google-sheets";
import { currentUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const owner = user.role === "admin" ? body.owner : user.owner;

  if (!body.task || !owner || !body.area || !body.dueDate) {
    return NextResponse.json({ error: "Task, owner, area, and due date are required" }, { status: 400 });
  }

  await appendTask({
    task: body.task,
    owner,
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
