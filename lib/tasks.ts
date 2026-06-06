export const TASK_COLUMNS = [
  "Task ID",
  "Task",
  "Owner",
  "Area",
  "Priority",
  "Status",
  "Due Date",
  "Blocker",
  "Next Action",
  "Link",
  "Notes"
] as const;

export const SETUP = {
  areas: ["Sales", "Legal", "Finance", "Banks", "Construction", "Marketing", "Operations", "Admin", "Forest Studio", "Network"],
  priorities: ["Urgent", "High", "Medium", "Low"],
  statuses: ["To Do", "Doing", "Waiting", "Blocked", "Done"]
};

export type TaskStatus = (typeof SETUP.statuses)[number];
export type TaskPriority = (typeof SETUP.priorities)[number];

export type Task = {
  rowNumber: number;
  taskId: string;
  task: string;
  owner: string;
  area: string;
  priority: string;
  status: string;
  dueDate: string;
  blocker: string;
  nextAction: string;
  link: string;
  notes: string;
};

export type TaskSectionId = "overdue" | "blocked" | "waiting" | "this-week" | "priority";

export type TaskSection = {
  id: TaskSectionId;
  title: string;
  tasks: Task[];
};

export function isOpenTask(task: Task) {
  return normalize(task.status) !== "done";
}

export function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function parseSheetDate(value: string) {
  if (!value) return null;

  const serial = Number(value);
  if (!Number.isNaN(serial) && serial > 0) {
    const utcDays = Math.floor(serial - 25569);
    return new Date(utcDays * 86400 * 1000);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDate(value: string) {
  const date = parseSheetDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function sheetDateValue(value: string) {
  const date = parseSheetDate(value);
  if (!date) return "";

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function dayKey(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function classifyTask(task: Task, now = new Date()): TaskSectionId | null {
  if (!isOpenTask(task)) return null;

  const due = parseSheetDate(task.dueDate);
  const today = dayKey(now);

  if (normalize(task.status) === "blocked") return "blocked";
  if (normalize(task.status) === "waiting") return "waiting";
  if (due && dayKey(due) < today) return "overdue";
  if (due && dayKey(due) >= today && dayKey(due) <= today + 7 * 86400 * 1000) return "this-week";
  if (["urgent", "high"].includes(normalize(task.priority))) return "priority";

  return null;
}

export function buildSections(tasks: Task[]) {
  const sectionMap: Record<TaskSectionId, TaskSection> = {
    overdue: { id: "overdue", title: "Overdue", tasks: [] },
    blocked: { id: "blocked", title: "Blocked", tasks: [] },
    waiting: { id: "waiting", title: "Waiting", tasks: [] },
    "this-week": { id: "this-week", title: "This Week", tasks: [] },
    priority: { id: "priority", title: "Open Urgent / High Priority", tasks: [] }
  };

  tasks.forEach((task) => {
    const section = classifyTask(task);
    if (section) sectionMap[section].tasks.push(task);
  });

  Object.values(sectionMap).forEach((section) => {
    section.tasks.sort(compareTasks);
  });

  return Object.values(sectionMap);
}

export function compareTasks(a: Task, b: Task) {
  const priorityOrder = ["urgent", "high", "medium", "low"];
  const priorityA = priorityOrder.indexOf(normalize(a.priority));
  const priorityB = priorityOrder.indexOf(normalize(b.priority));
  const priorityCompare = (priorityA === -1 ? 99 : priorityA) - (priorityB === -1 ? 99 : priorityB);
  if (priorityCompare !== 0) return priorityCompare;

  const dueA = parseSheetDate(a.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
  const dueB = parseSheetDate(b.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
  if (dueA !== dueB) return dueA - dueB;

  return a.task.localeCompare(b.task);
}
