export type AldeaRole = "admin" | "user";

export type AldeaUser = {
  email: string;
  name: string;
  owner: string;
  signalOwner?: string;
  role: AldeaRole;
  apps: string[];
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function spreadsheetId() {
  return process.env.TASK_MASTER_SPREADSHEET_ID || "1If7kubSY1j2eYxnQtpYwyo2YOpw-RPlT7aO_3EQubxk";
}

export function authSecret() {
  return requiredEnv("AUTH_SECRET");
}

export function googleOAuthConfig() {
  return {
    clientId: requiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: `${appUrl()}/api/auth/callback`
  };
}

export function googleServiceAccountConfig() {
  return {
    email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n")
  };
}

export function syncSecretToken() {
  return requiredEnv("SYNC_SECRET_TOKEN");
}

export function notionConfig() {
  const configuredTrailId = requiredEnv("NOTION_TRAILS_DATABASE_ID");
  const normalizedTrailId = configuredTrailId === "73904db2-fcb5-4a6a-b4d5-f6dc219b4409"
    ? "12fc622a-82fb-8052-85d9-f4e48a5adb6d"
    : configuredTrailId;

  return {
    token: requiredEnv("NOTION_API_TOKEN"),
    trailsDatabaseId: normalizedTrailId,
    syncOwnerName: requiredEnv("ALDEA_SYNC_OWNER_NAME"),
    portfolioDatabaseId: process.env.NOTION_PORTFOLIO_DATABASE_ID || "2f0c622a-82fb-801c-8ee6-e9ccd66ef85f",
    stretchDatabaseId: process.env.NOTION_STRETCH_DATABASE_ID || "15c7f164-ae67-4bdd-9476-cc70ce53bf68"
  };
}

export function approvedUsers(): AldeaUser[] {
  const raw = process.env.ALDEA_USERS_JSON;
  if (!raw) return [];

  const parsed = JSON.parse(raw) as AldeaUser[];
  return parsed.map((user) => ({
    ...user,
    email: user.email.toLowerCase().trim(),
    role: user.role === "admin" ? "admin" : "user",
    apps: user.apps || []
  }));
}

export function findApprovedUser(email: string) {
  return approvedUsers().find((user) => user.email === email.toLowerCase().trim()) || null;
}
