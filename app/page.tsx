import TaskDashboard from "@/components/task-dashboard";
import { getSetupOwners, getTaskRows } from "@/lib/google-sheets";
import { currentUser } from "@/lib/session";
import { canSeeTask } from "@/lib/task-access";
import { buildSections } from "@/lib/tasks";

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

  const [tasks, owners] = await Promise.all([getTaskRows(), getSetupOwners()]);
  const visibleTasks = tasks.filter((task) => canSeeTask(user, task));

  return (
    <TaskDashboard
      user={user}
      sections={buildSections(visibleTasks)}
      owners={owners}
      allTasks={visibleTasks}
    />
  );
}

function LoginScreen({ authError }: { authError?: string }) {
  const message = authError ? authErrorMessage(authError) : null;

  return (
    <main className="login-screen">
      <section className="login-panel">
        <p className="brand">ALDEA</p>
        <h1>Task Manager</h1>
        <p className="login-copy">
          Sign in with your approved Google account to see the task dashboard assigned to you.
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

function authErrorMessage(code: string) {
  const messages: Record<string, string> = {
    "state-failed": "The login session expired. Please try again.",
    "missing-code": "Google did not return a login code. Please try again.",
    "token-failed": "Google login could not be completed. Please try again.",
    "email-unverified": "Please use a verified Google account.",
    "not-approved": "This Google account is not approved for ALDEA Task Manager."
  };

  return messages[code] || "Login could not be completed. Please try again.";
}
