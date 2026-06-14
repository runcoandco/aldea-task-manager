import type { AldeaUser } from "./config";
import type { Task } from "./tasks";
import { isSensitiveArea, normalize } from "./tasks";

export function canSeeTask(user: AldeaUser, task: Task) {
  if (user.role === "admin") return true;
  return !isSensitiveArea(task.area);
}

export function canEditTask(user: AldeaUser, task: Task) {
  return user.role === "admin" || normalize(task.owner) === normalize(user.owner);
}

export function requireAdmin(user: AldeaUser) {
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
}
