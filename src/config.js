// In local development, these variables are loaded from .env by the entry point before this module is imported.

const requiredVars = ['CLICKUP_TOKEN', 'CLICKUP_TEAM_ID', 'GOOGLE_SPREADSHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_KEY'];

const missing = requiredVars.filter((v) => !process.env[v]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const config = {
  clickupToken: process.env.CLICKUP_TOKEN,
  clickupTeamId: process.env.CLICKUP_TEAM_ID,
  googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  googleServiceAccountKey: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
};

Object.freeze(config);

export function getConfig() {
  return config;
}
