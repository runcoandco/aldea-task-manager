import { NextResponse } from "next/server";
import { canUseRolodex } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { cleanCategories, createRolodexContact, type RolodexDraft } from "@/lib/rolodex";

const fields: (Exclude<keyof RolodexDraft, "categories">)[] = [
  "fullName", "phoneNumber", "email", "country", "lives", "company", "work", "relation", "internalPrimaryContact"
];

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseRolodex(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || fields.some((field) => body[field] !== undefined && typeof body[field] !== "string")) {
    return NextResponse.json({ error: "Invalid contact." }, { status: 400 });
  }

  const categories = cleanCategories(body.categories);
  if (!categories) return NextResponse.json({ error: "Invalid Categories." }, { status: 400 });
  const draft = {
    ...Object.fromEntries(fields.map((field) => [field, String(body[field] ?? "").trim()])),
    categories
  } as RolodexDraft;
  if (!draft.fullName) {
    return NextResponse.json({ error: "Full Name is required." }, { status: 400 });
  }
  if (!draft.phoneNumber && !draft.email) {
    return NextResponse.json({ error: "Phone Number or Email is required." }, { status: 400 });
  }

  const contactId = await createRolodexContact(draft);
  return NextResponse.json({ ok: true, contactId }, { status: 201 });
}
