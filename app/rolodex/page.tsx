import { redirect } from "next/navigation";
import RolodexApp from "@/components/rolodex-app";
import { currentUser } from "@/lib/session";
import { getRolodexContacts, rolodexPrimaryContactOptions } from "@/lib/rolodex";

export default async function RolodexPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/");
  }

  const [contacts, primaryContacts] = await Promise.all([
    getRolodexContacts(),
    Promise.resolve(rolodexPrimaryContactOptions())
  ]);

  return (
    <RolodexApp
      user={user}
      contacts={contacts}
      primaryContacts={primaryContacts}
    />
  );
}
