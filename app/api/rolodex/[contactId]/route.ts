import { NextResponse } from "next/server";
import { canUseRolodex } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { cleanCategories, updateRolodexContact, type RolodexDraft } from "@/lib/rolodex";

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
  const body = await request.json().catch(() => null) as (Partial<RolodexDraft> & { rowNumber?: number }) | null;
  if (!body?.rowNumber) {
    return NextResponse.json({ error: "Missing row number." }, { status: 400 });
  }
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

  await updateRolodexContact(body.rowNumber, updates);

  return NextResponse.json({ ok: true, contactId });
}
