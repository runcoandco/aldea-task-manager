import { approvedUsers, rolodexSpreadsheetId } from "./config";
import { batchUpdateSheetValues, getSheetValues } from "./google-sheets";

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
  internalPrimaryContact: "J"
};

export async function getRolodexContacts(): Promise<RolodexContact[]> {
  return (await getSheetValues("Rolodex!A2:J2000", rolodexSpreadsheetId()))
    .map((row, index) => rowToContact(row, index + 2))
    .filter((contact) => contact.contactId || contact.fullName);
}

export async function updateRolodexContact(rowNumber: number, updates: Partial<RolodexDraft>) {
  const data = Object.entries(updates).flatMap(([field, value]) => {
    const column = ROLEDEX_COLUMNS[field as keyof RolodexDraft];
    if (!column) return [];

    return [{
      range: `Rolodex!${column}${rowNumber}`,
      values: [[String(value || "").trim()]]
    }];
  });

  await batchUpdateSheetValues(data, rolodexSpreadsheetId());
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
    internalPrimaryContact: value(9)
  };
}
