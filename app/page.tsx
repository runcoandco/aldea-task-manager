import { currentUser } from "@/lib/session";

export default async function Home({
  searchParams
}: {
  searchParams?: Promise<{ auth?: string }>;
}) {
  const user = await currentUser();

  if (!user) {
    const params = await searchParams;
    return <LoginScreen authError={params?.auth} />;
  }

  return <AppShell user={user} />;
}

function LoginScreen({ authError }: { authError?: string }) {
  const message = authError ? authErrorMessage(authError) : null;

  return (
    <main className="login-screen">
      <section className="login-panel">
        <img className="login-logo" src="/aldea-logo.png" alt="ALDEA Comporta" />
        <p className="login-copy">
          Sign in with your approved Google account to open your ALDEA workspace.
        </p>
        {message ? <p className="auth-error">{message}</p> : null}
        <form action="/api/auth/google">
          <button className="primary-button" type="submit">
            Continue with Google
          </button>
        </form>
      </section>
    </main>
  );
}

function AppShell({
  user
}: {
  user: {
    name: string;
    role: "admin" | "user";
    apps: string[];
  };
}) {
  const availableApps = [
    {
      id: "task-manager",
      eyebrow: "Operations",
      title: "Task Manager",
      description: "Review assigned work, update status, and keep the team dashboard current.",
      href: "/task-manager",
      enabled: true
    },
    {
      id: "signal",
      eyebrow: "Sales CRM",
      title: "Signal",
      description: "Log lead signals and next steps from active sales opportunities.",
      href: "/api/signal/launch",
      enabled: true
    },
    {
      id: "rolodex",
      eyebrow: "Network",
      title: "ALDEA Rolodex",
      description: "Search, review, and update ALDEA contacts from the shared Rolodex.",
      href: "/rolodex",
      enabled: true
    }
  ].filter((app) => app.id === "rolodex" || user.apps.includes(app.id));

  return (
    <main className="shell-screen">
      <section className="shell-panel">
        <div className="shell-topbar">
          <div>
            <img className="shell-logo" src="/aldea-logo.png" alt="ALDEA Comporta" />
            <p className="shell-kicker">Workspace</p>
            <h1>Welcome, {user.name}</h1>
            <p className="shell-copy">
              Choose the ALDEA tool you want to open.
            </p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="ghost-button shell-signout" type="submit">
              Sign Out
            </button>
          </form>
        </div>

        <div className="shell-meta">
          <span>{user.role === "admin" ? "Admin Access" : "User Access"}</span>
          <span>{availableApps.length} App{availableApps.length === 1 ? "" : "s"} Available</span>
        </div>

        <div className="shell-app-grid">
          {availableApps.map((app) => (
            <a
              aria-disabled={!app.enabled}
              className={`shell-app-card ${app.enabled ? "" : "is-disabled"}`}
              href={app.enabled ? app.href : "#"}
              key={app.id}
            >
              <span className="shell-app-eyebrow">{app.eyebrow}</span>
              <strong>{app.title}</strong>
              <span>{app.description}</span>
              <em>{app.enabled ? "Open App" : "Coming Soon"}</em>
            </a>
          ))}
        </div>

        {availableApps.length === 0 ? (
          <p className="auth-error">This account is approved, but no apps have been assigned yet.</p>
        ) : null}
      </section>
    </main>
  );
}

function authErrorMessage(code: string) {
  const messages: Record<string, string> = {
    "state-failed": "The login session expired. Please try again.",
    "missing-code": "Google did not return a login code. Please try again.",
    "token-failed": "Google login could not be completed. Please try again.",
    "email-unverified": "Please use a verified Google account.",
    "not-approved": "This Google account is not approved for the ALDEA workspace."
  };

  return messages[code] || "Login could not be completed. Please try again.";
}
