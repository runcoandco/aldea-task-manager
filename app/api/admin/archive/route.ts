import { NextResponse } from "next/server";
import { archiveDoneTasks } from "@/lib/google-sheets";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/task-access";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const archived = await archiveDoneTasks();
    return NextResponse.json({ success: true, archived });
  } catch (error) {
    console.error("Archive Done failed", error);
    return NextResponse.json({ error: "Archive failed" }, { status: 500 });
  }
}
