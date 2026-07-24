// Auth0 tenant settings. Fill these in from the Auth0 dashboard
// (Applications → your app → Settings). See website/README.md for setup steps.
export const authConfig = {
  domain: 'scc4t.us.auth0.com',
  clientId: 'YEELbmsY27hdZqTLxVd6b6uZ7r8cyvou',
  // The Identifier of the Auth0 API (Applications → APIs) — must match it
  // exactly. Required for the server to verify access tokens.
  audience: 'https://api.scc4t.com',
  // Where the API server lives. Empty = same origin (local dev with server.mjs).
  // For the GitHub Pages site, set your VPS URL, e.g. 'https://api.yourdomain.com'.
  apiBase: 'https://api.scc4t.com',
  // Origins allowed to call the API cross-origin (server.mjs reads this list).
  // Add the GitHub Pages origin, e.g. 'https://<user>.github.io'.
  corsOrigins: ['http://localhost:4173', 'https://www.scc4t.com', 'https://scc4t.com'],
};
