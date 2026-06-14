import { notionConfig } from "@/lib/config";

const NOTION_VERSION = "2022-06-28";
const NOTION_API_BASE = "https://api.notion.com/v1";

type NotionRichText = {
  plain_text?: string;
  text?: { content?: string };
};

type NotionTitleProperty = {
  title?: NotionRichText[];
};

type NotionSelectProperty = {
  select?: { name?: string | null };
  status?: { name?: string | null };
};

type NotionDateProperty = {
  date?: { start?: string | null };
};

type NotionRelationProperty = {
  relation?: { id: string }[];
};

export type NotionPage = {
  id: string;
  properties: Record<string, NotionTitleProperty | NotionSelectProperty | NotionDateProperty | NotionRelationProperty | undefined>;
};

type QueryDatabaseOptions = {
  filter?: Record<string, unknown>;
  page_size?: number;
  sorts?: Record<string, unknown>[];
};

function notionHeaders() {
  const { token } = notionConfig();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION
  };
}

async function notionFetch<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers: {
      ...notionHeaders(),
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Notion request failed: ${response.status} ${message}`);
  }

  return response.json() as Promise<T>;
}

export async function queryDatabase<TPage extends NotionPage = NotionPage>(
  databaseId: string,
  options: QueryDatabaseOptions = {}
) {
  const results: TPage[] = [];
  let cursor: string | undefined;

  do {
    const data = await notionFetch<{
      results: TPage[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({
        ...options,
        start_cursor: cursor
      })
    });

    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor || undefined : undefined;
  } while (cursor);

  return results;
}

export async function createPage(body: Record<string, unknown>) {
  return notionFetch<NotionPage>("/pages", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function updatePage(pageId: string, body: Record<string, unknown>) {
  return notionFetch<NotionPage>(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function extractTitle(page: NotionPage, propertyName = "Task") {
  const property = page.properties[propertyName] as NotionTitleProperty | undefined;
  return (property?.title || [])
    .map((item) => item.plain_text || item.text?.content || "")
    .join("")
    .trim();
}

export function extractSelect(page: NotionPage, propertyName: string) {
  const property = page.properties[propertyName] as NotionSelectProperty | undefined;
  return property?.select?.name || property?.status?.name || "";
}

export function extractDate(page: NotionPage, propertyName: string) {
  const property = page.properties[propertyName] as NotionDateProperty | undefined;
  return property?.date?.start || "";
}

export function extractRelationIds(page: NotionPage, propertyName: string) {
  const property = page.properties[propertyName] as NotionRelationProperty | undefined;
  return (property?.relation || []).map((item) => item.id);
}
