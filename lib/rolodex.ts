import { approvedUsers, rolodexSpreadsheetId } from "./config";
import { appendSheetValues, batchUpdateSheetValues, getSheetValues } from "./google-sheets";

export type RolodexContact = {
  rowNumber: number;
  contactId: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  country: string;
  lives: string;
  company: string;
  work: string;
  relation: string;
  internalPrimaryContact: string;
  categories: string[];
};

export type RolodexDraft = Omit<RolodexContact, "rowNumber" | "contactId">;

export const ROLEDEX_COLUMNS: Record<keyof RolodexDraft | "contactId", string> = {
  contactId: "A",
  fullName: "B",
  phoneNumber: "C",
  email: "D",
  country: "E",
  lives: "F",
  company: "G",
  work: "H",
  relation: "I",
  internalPrimaryContact: "J",
  categories: "K"
};

let categoryHeaderChecked = false;

async function ensureCategoryHeader() {
  if (categoryHeaderChecked) return;
  const spreadsheetId = rolodexSpreadsheetId();
  const rows = await getSheetValues("Rolodex!K1", spreadsheetId);
  const header = String(rows[0]?.[0] || "").trim();
  if (header !== "Categories" && header !== "Category") {
    throw new Error("Rolodex column K must have a Categories header.");
  }
  categoryHeaderChecked = true;
}

export async function getRolodexContacts(): Promise<RolodexContact[]> {
  await ensureCategoryHeader();
  return (await getSheetValues("Rolodex!A2:K", rolodexSpreadsheetId()))
    .map((row, index) => rowToContact(row, index + 2))
    .filter((contact) => contact.contactId || contact.fullName);
}

export async function updateRolodexContact(rowNumber: number, updates: Partial<RolodexDraft>) {
  if (updates.categories !== undefined) await ensureCategoryHeader();
  const data = Object.entries(updates).flatMap(([field, value]) => {
    if (value === undefined) return [];
    const column = ROLEDEX_COLUMNS[field as keyof RolodexDraft];
    if (!column) return [];

    return [{
      range: `Rolodex!${column}${rowNumber}`,
      values: [[field === "categories" ? JSON.stringify(value || []) : String(value || "").trim()]]
    }];
  });

  await batchUpdateSheetValues(data, rolodexSpreadsheetId());
}

export async function createRolodexContact(draft: RolodexDraft) {
  await ensureCategoryHeader();
  const contactId = crypto.randomUUID();
  await appendSheetValues("Rolodex!A:K", [
    [contactId, ...Object.keys(ROLEDEX_COLUMNS)
      .filter((field) => field !== "contactId")
      .map((field) => field === "categories"
        ? JSON.stringify(draft.categories)
        : String(draft[field as keyof RolodexDraft]).trim())]
  ], rolodexSpreadsheetId());
  return contactId;
}

export function rolodexPrimaryContactOptions() {
  return approvedUsers()
    .map((user) => user.name.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function rowToContact(row: unknown[], rowNumber: number): RolodexContact {
  const value = (index: number) => String(row[index] || "").trim();

  return {
    rowNumber,
    contactId: value(0),
    fullName: value(1),
    phoneNumber: value(2),
    email: value(3),
    country: value(4),
    lives: value(5),
    company: value(6),
    work: value(7),
    relation: value(8),
    internalPrimaryContact: value(9),
    categories: parseCategories(value(10))
  };
}

function parseCategories(value: string): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // Support categories entered directly in the Sheet.
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function cleanCategories(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20 || value.some((item) => typeof item !== "string")) return null;
  const categories: string[] = [];
  for (const item of value as string[]) {
    const category = item.trim();
    if (!category || category.length > 60) return null;
    if (!categories.some((existing) => existing.toLocaleLowerCase() === category.toLocaleLowerCase())) {
      categories.push(category);
    }
  }
  return categories;
}
