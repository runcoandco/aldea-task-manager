import { NextResponse } from "next/server";
import { canUseRolodex } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { cleanCategories, deleteRolodexContact, updateRolodexContact, type RolodexDraft } from "@/lib/rolodex";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseRolodex(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { contactId } = await params;
  const body = await request.json().catch(() => null) as Partial<RolodexDraft> | null;
  if (!body) return NextResponse.json({ error: "Invalid contact." }, { status: 400 });
  const categories = cleanCategories(body.categories);
  if (!categories) return NextResponse.json({ error: "Invalid Categories." }, { status: 400 });

  const updates: Partial<RolodexDraft> = {
    fullName: body.fullName,
    phoneNumber: body.phoneNumber,
    email: body.email,
    country: body.country,
    lives: body.lives,
    company: body.company,
    work: body.work,
    relation: body.relation,
    internalPrimaryContact: body.internalPrimaryContact,
    categories: body.categories === undefined ? undefined : categories
  };

  const result = await updateRolodexContact(contactId, updates);
  if (result === "not-found") return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  if (result === "duplicate") return NextResponse.json({ error: "Duplicate contact ID. No contact was saved." }, { status: 409 });

  return NextResponse.json({ ok: true, contactId });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseRolodex(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { contactId } = await params;
  try {
    const result = await deleteRolodexContact(contactId);
    if (result === "not-found") return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    if (result === "duplicate") return NextResponse.json({ error: "Duplicate contact ID. No contact was deleted." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Rolodex delete failed", error);
    return NextResponse.json({ error: "Contact could not be deleted." }, { status: 500 });
  }
}
