import type { AldeaUser } from "./config";
import type { Task } from "./tasks";
import { normalize } from "./tasks";

export function canSeeTask(user: AldeaUser, task: Task) {
  if (user.role === "admin") return true;
  return normalize(task.owner) === normalize(user.owner) || normalize(task.createdBy) === normalize(user.email);
}

export function canEditTask(user: AldeaUser, task: Task) {
  return user.role === "admin" || canSeeTask(user, task);
}

export function requireAdmin(user: AldeaUser) {
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
}
