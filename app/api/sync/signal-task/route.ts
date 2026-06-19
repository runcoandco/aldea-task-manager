import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { findApprovedUserByOwnerName, signalTaskSyncSecret } from "@/lib/config";
import { appendTask, deleteTaskRow, getSetupOwners, getTaskRows } from "@/lib/google-sheets";

type SignalTaskPayload = {
  leadName?: string;
  whatHappened?: string;
  nextAction?: string;
  nextActionDate?: string;
  nextActionOwner?: string;
  submitter?: string;
};

function isAuthorized(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token === signalTaskSyncSecret();
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function buildSignalTaskKey(body: Required<SignalTaskPayload>) {
  const raw = [
    body.leadName,
    body.whatHappened,
    body.nextAction,
    body.nextActionDate,
    body.nextActionOwner,
    body.submitter
  ].map((value) => normalize(value)).join("|");

  return `signal-sync:${createHash("sha256").update(raw).digest("hex").slice(0, 24)}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Configuration error"
    }, { status: 500 });
  }

  try {
    const body = await request.json() as SignalTaskPayload;
    const requiredFields: Array<keyof SignalTaskPayload> = [
      "leadName",
      "whatHappened",
      "nextAction",
      "nextActionDate",
      "nextActionOwner",
      "submitter"
    ];

    for (const field of requiredFields) {
      if (!String(body[field] || "").trim()) {
        return NextResponse.json({ success: false, error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const payload = {
      leadName: String(body.leadName).trim(),
      whatHappened: String(body.whatHappened).trim(),
      nextAction: String(body.nextAction).trim(),
      nextActionDate: String(body.nextActionDate).trim(),
      nextActionOwner: String(body.nextActionOwner).trim(),
      submitter: String(body.submitter).trim()
    };

    const ownerUser = findApprovedUserByOwnerName(payload.nextActionOwner);
    if (!ownerUser) {
      return NextResponse.json({ success: false, error: `Unknown task owner: ${payload.nextActionOwner}` }, { status: 400 });
    }

    const submitterUser = findApprovedUserByOwnerName(payload.submitter);
    const taskOwner = ownerUser.owner;
    const taskAssigner = submitterUser?.owner || payload.submitter;
    const taskKey = buildSignalTaskKey(payload);

    const [owners, tasks] = await Promise.all([getSetupOwners(), getTaskRows()]);
    if (!owners.includes(taskOwner)) {
      return NextResponse.json({ success: false, error: `Invalid task owner: ${taskOwner}` }, { status: 400 });
    }

    const existingTask = tasks.find((task) => task.createdBy === taskKey);
    if (existingTask) {
      return NextResponse.json({
        success: true,
        created: false,
        taskId: existingTask.taskId
      });
    }

    const createdTask = await appendTask({
      task: `${payload.leadName} - ${payload.nextAction}`,
      owner: taskOwner,
      area: "Sales",
      priority: "High",
      status: "To Do",
      dueDate: payload.nextActionDate,
      blocker: "",
      nextAction: "",
      link: "",
      notes: `Lead: ${payload.leadName}\nLatest signal: ${payload.whatHappened}`,
      createdBy: taskKey,
      assignedBy: taskAssigner
    });

    const matchingTasks = (await getTaskRows())
      .filter((task) => task.createdBy === taskKey)
      .sort((a, b) => a.rowNumber - b.rowNumber);
    const canonicalTask = matchingTasks[0];

    if (matchingTasks.length > 1 && canonicalTask && canonicalTask.rowNumber !== createdTask.rowNumber) {
      await deleteTaskRow(createdTask.rowNumber);

      return NextResponse.json({
        success: true,
        created: false,
        taskId: canonicalTask.taskId
      });
    }

    return NextResponse.json({
      success: true,
      created: true,
      taskId: canonicalTask?.taskId || createdTask.taskId
    });
  } catch (error) {
    console.error("Signal task sync failed", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Task sync failed"
    }, { status: 500 });
  }
}
