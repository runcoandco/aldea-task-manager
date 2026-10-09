/**
 * ALDEA Task Manager and Notion Trail sync.
 * Version: v2026.10.09-01
 * Last Updated: 2026-10-09 Europe/Lisbon
 *
 * What this script does:
 * 1. Syncs assigned Sheet tasks into Notion.
 * 2. Creates Sheet tasks from approved Notion templates.
 * 3. Returns Achieved tasks to Sheets as Done.
 */

import { notionConfig } from "@/lib/config";
import { appendTask, deleteTaskRow, getTaskRows, updateTaskCells } from "@/lib/google-sheets";
import {
  createPage,
  extractDate,
  extractRelationIds,
  extractSelect,
  extractTitle,
  type NotionPage,
  queryDatabase,
  updatePage
} from "@/lib/notion";
import { normalize, parseSheetDate, SETUP, type Task } from "@/lib/tasks";

type SyncSectionSummary = {
  errors: number;
};

type InboundSummary = SyncSectionSummary & {
  tasksRead: number;
  tasksEligible: number;
  trailsCreated: number;
  trailsUpdated: number;
  skipped: number;
};

type ReturnSummary = SyncSectionSummary & {
  achievedDetected: number;
  markedDone: number;
  alreadyDone: number;
  notFoundInSheet: number;
};

type NotionOriginSummary = SyncSectionSummary & {
  readyDetected: number;
  createdInSheets: number;
  recovered: number;
  validationErrors: number;
  duplicatesRemoved: number;
};

export type AldeaTrailSyncResult = {
  success: true;
  timestamp: string;
  owner: string;
  notionOrigin: NotionOriginSummary;
  inbound: InboundSummary;
  return: ReturnSummary;
  log: string[];
};

type NotionTrailPage = NotionPage;

type NotionProjectPage = NotionPage;

type NotionStretchPage = NotionPage & {
  created_time?: string;
};

type StretchResolution = {
  id: string | null;
  source: "active" | "fallback" | "missing" | "ambiguous";
};

const ALDEA_PROJECT_NAME = "ALDEA";
const NOTION_SYNC_PROPERTY = "ALDEA Sync";
const NOTION_SYNC_ERROR_PROPERTY = "ALDEA Sync Error";
const NOTION_SYNC_READY = "Ready";
const NOTION_SYNC_SYNCED = "Synced";
const NOTION_SYNC_ERROR = "Error";

function formatNotionDate(value: string) {
  const parsed = parseSheetDate(value);
  if (!parsed) return null;
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTrailTitle(task: Task) {
  return `${task.taskId} ${task.task}`.trim();
}

function buildLogMessage(taskId: string, message: string) {
  return `${taskId} ${message}`;
}

function extractTaskId(value: string) {
  const match = value.match(/TASK-\d{4,}/);
  return match ? match[0] : null;
}

function priorityToNotion(priority: string) {
  switch (normalize(priority)) {
    case "urgent":
      return "Urgent";
    case "high":
      return "High";
    case "medium":
      return "Mid";
    case "low":
      return "Low";
    default:
      return null;
  }
}

function priorityFromNotion(priority: string) {
  switch (normalize(priority)) {
    case "urgent":
      return "Urgent";
    case "high":
      return "High";
    case "mid":
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Medium";
  }
}

function notionSourceKey(pageId: string) {
  return `notion:${pageId}`;
}

function notionPageUrl(page: NotionPage) {
  return page.url || `https://www.notion.so/${page.id.replace(/-/g, "")}`;
}

function richTextValue(value: string) {
  return {
    rich_text: value ? [{ type: "text", text: { content: value.slice(0, 2000) } }] : []
  };
}

async function markNotionOriginError(pageId: string, message: string) {
  await updatePage(pageId, {
    properties: {
      [NOTION_SYNC_PROPERTY]: { select: { name: NOTION_SYNC_ERROR } },
      [NOTION_SYNC_ERROR_PROPERTY]: richTextValue(message)
    }
  });
}

async function markNotionOriginSynced(input: {
  page: NotionTrailPage;
  taskId: string;
  title: string;
  projectId: string;
  stretch: StretchResolution;
}) {
  const updates: Record<string, unknown> = {
    Task: {
      title: [{ type: "text", text: { content: `${input.taskId} ${input.title}`.trim() } }]
    },
    [NOTION_SYNC_PROPERTY]: { select: { name: NOTION_SYNC_SYNCED } },
    [NOTION_SYNC_ERROR_PROPERTY]: richTextValue("")
  };

  if (!extractSelect(input.page, "Action Stage")) {
    updates["Action Stage"] = { status: { name: "Planned" } };
  }
  if (!extractSelect(input.page, "Difficulty Level")) {
    updates["Difficulty Level"] = { select: { name: "3" } };
  }
  if (!extractRelationIds(input.page, "Project").length) {
    updates.Project = { relation: [{ id: input.projectId }] };
  }
  if (input.stretch.id && !extractRelationIds(input.page, "Stretch").length) {
    updates.Stretch = { relation: [{ id: input.stretch.id }] };
  }

  await updatePage(input.page.id, { properties: updates });
}

function textBlock(text: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: {
            content: text
          }
        }
      ]
    }
  };
}

function headingBlock(text: string) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [
        {
          type: "text",
          text: {
            content: text
          }
        }
      ]
    }
  };
}

function buildChildren(task: Task) {
  const sections: Array<{ heading: string; body: string }> = [
    {
      heading: "ALDEA Sync",
      body: [`Task ID: ${task.taskId}`, `Owner: ${task.owner}`, `Status in ALDEA: ${task.status}`].join("\n")
    }
  ];

  if (task.nextAction) sections.push({ heading: "Next Action", body: task.nextAction });
  if (task.blocker) sections.push({ heading: "Blocker", body: task.blocker });
  if (task.link) sections.push({ heading: "Link", body: task.link });
  if (task.notes) sections.push({ heading: "Notes", body: task.notes });

  return sections.flatMap((section) => [headingBlock(section.heading), textBlock(section.body)]);
}

function trailProperties(input: {
  title: string;
  dueDate: string | null;
  priority: string | null;
  difficultyLevel?: string;
  projectId?: string;
  stretchId?: string;
  includeStage?: boolean;
}) {
  return {
    Task: {
      title: [
        {
          type: "text",
          text: {
            content: input.title
          }
        }
      ]
    },
    "Due Date": input.dueDate ? { date: { start: input.dueDate } } : { date: null },
    "Priority Level": input.priority ? { select: { name: input.priority } } : undefined,
    "Difficulty Level": input.difficultyLevel ? { select: { name: input.difficultyLevel } } : undefined,
    [NOTION_SYNC_PROPERTY]: { select: { name: NOTION_SYNC_SYNCED } },
    [NOTION_SYNC_ERROR_PROPERTY]: richTextValue(""),
    ...(input.includeStage ? { "Action Stage": { status: { name: "Planned" } } } : {}),
    ...(input.projectId ? { Project: { relation: [{ id: input.projectId }] } } : {}),
    ...(input.stretchId ? { Stretch: { relation: [{ id: input.stretchId }] } } : {})
  };
}

async function findAldeaProjectId() {
  const { portfolioDatabaseId } = notionConfig();
  const projects = await queryDatabase<NotionProjectPage>(portfolioDatabaseId, {
    filter: {
      property: "Name",
      title: {
        equals: ALDEA_PROJECT_NAME
      }
    },
    page_size: 10
  });

  if (projects.length !== 1) {
    throw new Error(`Expected exactly one Portfolio project named ${ALDEA_PROJECT_NAME}, found ${projects.length}`);
  }

  return projects[0].id;
}

async function findCurrentStretchId(): Promise<StretchResolution> {
  const { stretchDatabaseId } = notionConfig();
  const today = new Date().toISOString().slice(0, 10);

  const active = await queryDatabase<NotionStretchPage>(stretchDatabaseId, {
    filter: {
      and: [
        {
          property: "Start Date",
          date: {
            on_or_before: today
          }
        },
        {
          property: "End Date",
          date: {
            on_or_after: today
          }
        }
      ]
    },
    page_size: 10
  });

  if (active.length === 1) return { id: active[0].id, source: "active" };
  if (active.length > 1) return { id: null, source: "ambiguous" };

  const fallback = await queryDatabase<NotionStretchPage>(stretchDatabaseId, {
    sorts: [
      {
        timestamp: "created_time",
        direction: "descending"
      }
    ],
    page_size: 1
  });

  if (fallback[0]?.id) {
    return { id: fallback[0].id, source: "fallback" };
  }

  return { id: null, source: "missing" };
}

async function findTrailMatches(taskId: string) {
  const { trailsDatabaseId } = notionConfig();
  const pages = await queryDatabase<NotionTrailPage>(trailsDatabaseId, {
    filter: {
      property: "Task",
      title: {
        contains: taskId
      }
    },
    page_size: 20
  });

  return pages.filter((page) => extractTitle(page, "Task").startsWith(taskId));
}

function dedupeEligibleTasks(tasks: Task[], log: string[]) {
  const seen = new Map<string, Task>();
  for (const task of tasks) {
    if (!seen.has(task.taskId)) {
      seen.set(task.taskId, task);
      continue;
    }
    log.push(buildLogMessage(task.taskId, "appears multiple times in Sheets; using first occurrence"));
  }
  return [...seen.values()];
}

async function runNotionOriginSync(input: {
  tasks: Task[];
  owner: string;
  projectId: string;
  stretch: StretchResolution;
  log: string[];
}) {
  const readyTrails = await queryDatabase<NotionTrailPage>(notionConfig().trailsDatabaseId, {
    filter: {
      property: NOTION_SYNC_PROPERTY,
      select: { equals: NOTION_SYNC_READY }
    },
    page_size: 100
  });

  const summary: NotionOriginSummary = {
    readyDetected: readyTrails.length,
    createdInSheets: 0,
    recovered: 0,
    validationErrors: 0,
    duplicatesRemoved: 0,
    errors: 0
  };

  let currentTasks = input.tasks;

  for (const trail of readyTrails) {
    const title = extractTitle(trail, "Task");
    const sourceKey = notionSourceKey(trail.id);
    const taskWithSource = currentTasks.find((task) => task.createdBy === sourceKey);
    const embeddedTaskId = extractTaskId(title);
    const taskWithEmbeddedId = embeddedTaskId
      ? currentTasks.find((task) => task.taskId === embeddedTaskId)
      : undefined;
    const existingTask = taskWithSource || taskWithEmbeddedId;

    try {
      if (existingTask) {
        const cleanTitle = title.replace(existingTask.taskId, "").trim();
        await markNotionOriginSynced({
          page: trail,
          taskId: existingTask.taskId,
          title: cleanTitle || existingTask.task,
          projectId: input.projectId,
          stretch: input.stretch
        });
        summary.recovered += 1;
        input.log.push(buildLogMessage(existingTask.taskId, "reconnected to its Notion source page"));
        continue;
      }

      if (!title) {
        await markNotionOriginError(trail.id, "Task is required.");
        summary.validationErrors += 1;
        input.log.push("A Notion task was not created in Sheets because Task is empty");
        continue;
      }

      if (embeddedTaskId) {
        await markNotionOriginError(trail.id, `Task ID ${embeddedTaskId} was not found in Sheets.`);
        summary.validationErrors += 1;
        input.log.push(buildLogMessage(embeddedTaskId, "was present in a Ready Notion page but was not found in Sheets"));
        continue;
      }

      const area = extractSelect(trail, "ALDEA Area");
      const dueDate = extractDate(trail, "Due Date");

      if (!SETUP.areas.some((validArea) => validArea === area)) {
        await markNotionOriginError(trail.id, "Area must match an ALDEA Task Manager area.");
        summary.validationErrors += 1;
        input.log.push(`Notion task "${title}" has an invalid or empty Area`);
        continue;
      }

      if (!dueDate) {
        await markNotionOriginError(trail.id, "Due Date is required.");
        summary.validationErrors += 1;
        input.log.push(`Notion task "${title}" has no Due Date`);
        continue;
      }

      const createdTask = await appendTask({
        task: title,
        owner: input.owner,
        area,
        priority: priorityFromNotion(extractSelect(trail, "Priority Level")),
        status: "To Do",
        dueDate,
        blocker: "",
        nextAction: "",
        link: notionPageUrl(trail),
        notes: "Created from Notion Trail.",
        createdBy: sourceKey,
        assignedBy: input.owner
      });

      const matchingTasks = (await getTaskRows())
        .filter((task) => task.createdBy === sourceKey)
        .sort((a, b) => a.rowNumber - b.rowNumber);
      const canonicalTask = matchingTasks[0];

      if (!canonicalTask) {
        throw new Error("The new Sheet task could not be read after creation.");
      }

      if (canonicalTask.rowNumber !== createdTask.rowNumber) {
        await deleteTaskRow(createdTask.rowNumber);
        summary.duplicatesRemoved += 1;
      } else {
        summary.createdInSheets += 1;
      }

      await markNotionOriginSynced({
        page: trail,
        taskId: canonicalTask.taskId,
        title,
        projectId: input.projectId,
        stretch: input.stretch
      });
      input.log.push(buildLogMessage(canonicalTask.taskId, "created in Sheets from Notion"));
      currentTasks = await getTaskRows();
    } catch (error) {
      summary.errors += 1;
      input.log.push(`Notion task "${title || trail.id}" failed during Sheet creation: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return summary;
}

async function runInboundSync(input: {
  eligibleTasks: Task[];
  projectId: string;
  stretch: StretchResolution;
  log: string[];
}) {
  const summary: InboundSummary = {
    tasksRead: 0,
    tasksEligible: input.eligibleTasks.length,
    trailsCreated: 0,
    trailsUpdated: 0,
    skipped: 0,
    errors: 0
  };

  if (input.stretch.source === "fallback") {
    input.log.push("No active Stretch matched today; using the most recently created Stretch as fallback");
  }

  if (input.stretch.source === "ambiguous") {
    input.log.push("Multiple active Stretch records matched today; synced Trails will be created without a Stretch relation");
  }

  if (input.stretch.source === "missing") {
    input.log.push("No current Stretch could be resolved; synced Trails will be created without a Stretch relation");
  }

  for (const task of input.eligibleTasks) {
    const title = buildTrailTitle(task);
    const dueDate = formatNotionDate(task.dueDate);
    const priority = priorityToNotion(task.priority);
    const difficultyLevel = "3";

    try {
      const matches = await findTrailMatches(task.taskId);
      if (matches.length > 1) {
        summary.skipped += 1;
        input.log.push(buildLogMessage(task.taskId, "has multiple matching Trails in Notion; skipped"));
        continue;
      }

      if (!priority) {
        input.log.push(buildLogMessage(task.taskId, `has unmapped priority "${task.priority}"; skipping priority update`));
      }

      if (matches.length === 0) {
        await createPage({
          parent: {
            database_id: notionConfig().trailsDatabaseId
          },
          properties: trailProperties({
            title,
            dueDate,
            priority,
            difficultyLevel,
            projectId: input.projectId,
            stretchId: input.stretch.id || undefined,
            includeStage: true
          }),
          children: buildChildren(task)
        });
        summary.trailsCreated += 1;
        input.log.push(buildLogMessage(task.taskId, "created in Notion"));
        continue;
      }

      const existing = matches[0];
      const updates: Record<string, unknown> = {};
      const existingTitle = extractTitle(existing, "Task");
      const existingDueDate = extractDate(existing, "Due Date");
      const existingPriority = extractSelect(existing, "Priority Level");
      const existingDifficultyLevel = extractSelect(existing, "Difficulty Level");
      const existingSyncState = extractSelect(existing, NOTION_SYNC_PROPERTY);
      const projectRelationIds = extractRelationIds(existing, "Project");
      const stretchRelationIds = extractRelationIds(existing, "Stretch");

      if (existingTitle !== title) {
        updates.Task = {
          title: [
            {
              type: "text",
              text: { content: title }
            }
          ]
        };
      }

      if ((dueDate || "") !== existingDueDate) {
        updates["Due Date"] = dueDate ? { date: { start: dueDate } } : { date: null };
      }

      if (priority && priority !== existingPriority) {
        updates["Priority Level"] = { select: { name: priority } };
      }

      if (!existingDifficultyLevel) {
        updates["Difficulty Level"] = { select: { name: difficultyLevel } };
      }

      if (existingSyncState !== NOTION_SYNC_SYNCED) {
        updates[NOTION_SYNC_PROPERTY] = { select: { name: NOTION_SYNC_SYNCED } };
        updates[NOTION_SYNC_ERROR_PROPERTY] = richTextValue("");
      }

      if (!projectRelationIds.length) {
        updates.Project = { relation: [{ id: input.projectId }] };
      }

      if (input.stretch.id && !stretchRelationIds.length) {
        updates.Stretch = { relation: [{ id: input.stretch.id }] };
      }

      if (!Object.keys(updates).length) {
        summary.skipped += 1;
        input.log.push(buildLogMessage(task.taskId, "already up to date"));
        continue;
      }

      await updatePage(existing.id, { properties: updates });
      summary.trailsUpdated += 1;
      input.log.push(buildLogMessage(task.taskId, "updated in Notion"));
    } catch (error) {
      summary.errors += 1;
      input.log.push(buildLogMessage(task.taskId, `failed during inbound sync: ${error instanceof Error ? error.message : "Unknown error"}`));
    }
  }

  return summary;
}

async function runReturnSync(input: { log: string[]; tasksById: Map<string, Task> }) {
  const summary: ReturnSummary = {
    achievedDetected: 0,
    markedDone: 0,
    alreadyDone: 0,
    notFoundInSheet: 0,
    errors: 0
  };

  const achievedTrails = await queryDatabase<NotionTrailPage>(notionConfig().trailsDatabaseId, {
    filter: {
      and: [
        {
          property: "Action Stage",
          status: {
            equals: "Achieved"
          }
        },
        {
          property: "Task",
          title: {
            contains: "TASK-"
          }
        }
      ]
    },
    page_size: 100
  });

  summary.achievedDetected = achievedTrails.length;

  for (const trail of achievedTrails) {
    const title = extractTitle(trail, "Task");
    const taskId = extractTaskId(title);

    if (!taskId) {
      summary.errors += 1;
      input.log.push(`Could not parse Task ID from Trail title "${title}"`);
      continue;
    }

    const task = input.tasksById.get(taskId);
    if (!task) {
      summary.notFoundInSheet += 1;
      input.log.push(buildLogMessage(taskId, "is Achieved in Notion but was not found in Sheets"));
      continue;
    }

    if (normalize(task.status) === "done") {
      summary.alreadyDone += 1;
      input.log.push(buildLogMessage(taskId, "already marked Done in Sheets"));
      continue;
    }

    try {
      await updateTaskCells(task.rowNumber, { status: "Done" });
      summary.markedDone += 1;
      input.log.push(buildLogMessage(taskId, "marked Done in Sheets"));
    } catch (error) {
      summary.errors += 1;
      input.log.push(buildLogMessage(taskId, `failed during return sync: ${error instanceof Error ? error.message : "Unknown error"}`));
    }
  }

  return summary;
}

export async function runAldeaTrailSync(): Promise<AldeaTrailSyncResult> {
  const { syncOwnerName } = notionConfig();
  const timestamp = new Date().toISOString();
  const log: string[] = [];

  const initialTasks = await getTaskRows();

  const [projectId, stretch] = await Promise.all([
    findAldeaProjectId(),
    findCurrentStretchId()
  ]);

  const notionOrigin = await runNotionOriginSync({
    tasks: initialTasks,
    owner: syncOwnerName,
    projectId,
    stretch,
    log
  });

  const allTasks = notionOrigin.createdInSheets || notionOrigin.duplicatesRemoved
    ? await getTaskRows()
    : initialTasks;
  const eligibleTasks = dedupeEligibleTasks(
    allTasks.filter((task) => (
      Boolean(task.taskId) &&
      Boolean(task.task) &&
      task.owner.trim() === syncOwnerName &&
      normalize(task.status) !== "done"
    )),
    log
  );

  const inbound = await runInboundSync({
    eligibleTasks,
    projectId,
    stretch,
    log
  });
  inbound.tasksRead = allTasks.length;

  const tasksById = new Map(allTasks.map((task) => [task.taskId, task]));
  const returnSummary = await runReturnSync({ log, tasksById });

  return {
    success: true,
    timestamp,
    owner: syncOwnerName,
    notionOrigin,
    inbound,
    return: returnSummary,
    log
  };
}
