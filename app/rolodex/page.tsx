import { redirect } from "next/navigation";
import RolodexApp from "@/components/rolodex-app";
import { currentUser } from "@/lib/session";
import { getRolodexContacts, rolodexPrimaryContactOptions, type RolodexContact } from "@/lib/rolodex";

export default async function RolodexPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/");
  }

  let contacts: RolodexContact[] = [];
  let loadError = "";
  const primaryContacts = rolodexPrimaryContactOptions();

  try {
    contacts = await getRolodexContacts();
  } catch (error) {
    console.error("Rolodex load failed", error);
    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "the configured Google service account";
    const reason = error instanceof Error ? error.message : "Unknown error";
    loadError = `Rolodex could not load the Google Sheet. Share it with ${serviceEmail}. Runtime error: ${reason}`;
  }

  return (
    <RolodexApp
      user={user}
      contacts={contacts}
      primaryContacts={primaryContacts}
      loadError={loadError}
    />
  );
}
