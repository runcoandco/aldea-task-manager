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
    loadError = "Rolodex could not load the Google Sheet. Check the sheet ID, tab name, and service account access.";
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
