import { googleServiceAccountConfig, spreadsheetId } from "./config";
import { TASK_COLUMNS, sheetDateValue, type Task } from "./tasks";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function base64Url(input: string | Uint8Array) {
  return Buffer.from(input).toString("base64url");
}

async function importPrivateKey(privateKey: string) {
  const pem = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  return crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(pem, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function createJwt() {
  const { email, privateKey } = googleServiceAccountConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now
  }));
  const signingInput = `${header}.${claim}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, Buffer.from(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: await createJwt()
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  };
  return cachedToken.accessToken;
}

async function sheetsFetch(path: string, init?: RequestInit, targetSpreadsheetId = spreadsheetId()) {
  const token = await getAccessToken();
  const response = await fetch(`${SHEETS_BASE_URL}/${targetSpreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google Sheets request failed: ${response.status} ${message}`);
  }

  return response;
}

export async function getSheetValues(range: string, targetSpreadsheetId = spreadsheetId()) {
  const response = await sheetsFetch(
    `${valuesPath(range)}?valueRenderOption=UNFORMATTED_VALUE`,
    undefined,
    targetSpreadsheetId
  );
  const data = await response.json() as { values?: unknown[][] };
  return data.values || [];
}

export async function batchUpdateSheetValues(
  data: { range: string; values: (string | number)[][] }[],
  targetSpreadsheetId = spreadsheetId()
) {
  if (!data.length) return;

  await sheetsFetch("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data
    })
  }, targetSpreadsheetId);
}

export async function getSheetsMetadata(targetSpreadsheetId = spreadsheetId()) {
  const response = await sheetsFetch("?fields=sheets(properties(sheetId,title))", undefined, targetSpreadsheetId);
  return response.json() as Promise<{ sheets: { properties: { sheetId: number; title: string } }[] }>;
}

function valuesPath(range: string, suffix = "") {
  return `/values/${encodeURIComponent(range)}${suffix}`;
}

export async function getTaskRows(): Promise<Task[]> {
  return (await getSheetValues("2_TASKS!A2:M1000"))
    .map((row, index) => rowToTask(row, index + 2))
    .filter((task) => task.taskId || task.task);
}

export async function getSetupOwners() {
  return (await getSheetValues("0_SETUP!A2:A200"))
    .map((row) => String(row[0] || "").trim())
    .filter(Boolean)
    .filter((owner) => owner !== "ALL");
}

export async function updateTaskCells(rowNumber: number, updates: Partial<Record<keyof Task, string>>) {
  const data: { range: string; values: string[][] }[] = [];

  Object.entries(updates).forEach(([field, value]) => {
    const column = taskFieldToColumn(field as keyof Task);
    if (!column) return;
    const cellValue = field === "dueDate" && value ? sheetDateValue(value) : value || "";
    data.push({
      range: `2_TASKS!${column}${rowNumber}`,
      values: [[cellValue]]
    });
  });

  if (!data.length) return;

  await batchUpdateSheetValues(data);
}

export async function appendTask(input: {
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
  createdBy: string;
  assignedBy: string;
}) {
  const tasks = await getTaskRows();
  const nextNumber = tasks.reduce((max, task) => {
    const match = task.taskId.match(/TASK-(\d+)/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0) + 1;
  const taskId = `TASK-${String(nextNumber).padStart(4, "0")}`;

  await sheetsFetch(`${valuesPath("2_TASKS!A:M", ":append")}?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({
      values: [[
        taskId,
        input.task,
        input.owner,
        input.area,
        input.priority || "Medium",
        input.status || "To Do",
        sheetDateValue(input.dueDate),
        input.blocker,
        input.nextAction,
        input.link,
        input.notes,
        input.createdBy,
        input.assignedBy
      ]]
    })
  });
}

export async function archiveDoneTasks() {
  const tasks = await getTaskRows();
  const doneTasks = tasks.filter((task) => task.status.toLowerCase().trim() === "done");
  if (!doneTasks.length) return 0;

  const archivedAt = new Date().toISOString();
  await sheetsFetch(`${valuesPath("3_ARCHIVE!A:N", ":append")}?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({
      values: doneTasks.map((task) => [
        task.taskId,
        task.task,
        task.owner,
        task.area,
        task.priority,
        task.status,
        task.dueDate,
        task.blocker,
        task.nextAction,
        task.link,
        task.notes,
        task.createdBy,
        task.assignedBy,
        archivedAt
      ])
    })
  });

  await batchDeleteRows(doneTasks.map((task) => task.rowNumber));
  return doneTasks.length;
}

export async function deleteTaskRow(rowNumber: number) {
  const metadata = await getSheetsMetadata();
  const taskSheetId = metadata.sheets.find((sheet) => sheet.properties.title === "2_TASKS")?.properties.sheetId;
  if (typeof taskSheetId !== "number") {
    throw new Error("Could not find 2_TASKS sheet ID");
  }

  await sheetsFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: taskSheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }
      ]
    })
  });
}

async function batchDeleteRows(rowNumbers: number[]) {
  const sorted = [...rowNumbers].sort((a, b) => b - a);
  const requests = sorted.map((rowNumber) => ({
    deleteDimension: {
      range: {
        sheetId: 0,
        dimension: "ROWS",
        startIndex: rowNumber - 1,
        endIndex: rowNumber
      }
    }
  }));

  const metadata = await getSheetsMetadata();
  const taskSheetId = metadata.sheets.find((sheet) => sheet.properties.title === "2_TASKS")?.properties.sheetId;
  if (typeof taskSheetId !== "number") {
    throw new Error("Could not find 2_TASKS sheet ID");
  }

  requests.forEach((request) => {
    request.deleteDimension.range.sheetId = taskSheetId;
  });

  await sheetsFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests })
  });
}

function rowToTask(row: unknown[], rowNumber: number): Task {
  const value = (index: number) => String(row[index] || "").trim();
  return {
    rowNumber,
    taskId: value(0),
    task: value(1),
    owner: value(2),
    area: value(3),
    priority: value(4),
    status: value(5),
    dueDate: value(6),
    blocker: value(7),
    nextAction: value(8),
    link: value(9),
    notes: value(10),
    createdBy: value(11),
    assignedBy: value(12)
  };
}

function taskFieldToColumn(field: keyof Task) {
  const map: Partial<Record<keyof Task, string>> = {
    taskId: "A",
    task: "B",
    owner: "C",
    area: "D",
    priority: "E",
    status: "F",
    dueDate: "G",
    blocker: "H",
    nextAction: "I",
    link: "J",
    notes: "K",
    createdBy: "L",
    assignedBy: "M"
  };
  return map[field];
}

export { TASK_COLUMNS };
