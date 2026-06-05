export type AldeaRole = "admin" | "user";

export type AldeaUser = {
  email: string;
  name: string;
  owner: string;
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
