export type AldeaRole = "admin" | "user";

export type AldeaUser = {
  email: string;
  name: string;
  owner: string;
  signalOwner?: string;
  role: AldeaRole;
  apps: string[];
};

function normalizePersonName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function firstNameToken(value: string) {
  return normalizePersonName(value).split(/\s+/)[0] || "";
}

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
  return requiredEnv("TASK_MASTER_SPREADSHEET_ID");
}

export function rolodexSpreadsheetId() {
  return requiredEnv("ROLEDEX_SPREADSHEET_ID");
}

export function signalAppUrl() {
  return requiredEnv("SIGNAL_APP_URL");
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

export function signalTaskSyncSecret() {
  return process.env.SIGNAL_TASK_SYNC_SECRET || syncSecretToken();
}

export function notionConfig() {
  return {
    token: requiredEnv("NOTION_API_TOKEN"),
    trailsDatabaseId: requiredEnv("NOTION_TRAILS_DATABASE_ID"),
    syncOwnerName: requiredEnv("ALDEA_SYNC_OWNER_NAME"),
    portfolioDatabaseId: requiredEnv("NOTION_PORTFOLIO_DATABASE_ID"),
    stretchDatabaseId: requiredEnv("NOTION_STRETCH_DATABASE_ID")
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

export function findApprovedUserByOwnerName(name: string) {
  const normalized = normalizePersonName(name);
  const firstToken = firstNameToken(name);
  return approvedUsers().find((user) => (
    normalizePersonName(user.owner) === normalized ||
    normalizePersonName(user.signalOwner || "") === normalized ||
    normalizePersonName(user.name) === normalized ||
    firstNameToken(user.owner) === firstToken ||
    firstNameToken(user.signalOwner || "") === firstToken ||
    firstNameToken(user.name) === firstToken
  )) || null;
}
