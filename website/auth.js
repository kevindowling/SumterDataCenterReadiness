import {authConfig} from './auth-config.js';

let clientPromise = null;

export const isConfigured = () =>
  typeof auth0 !== 'undefined' && !authConfig.domain.startsWith('YOUR_') && !authConfig.clientId.startsWith('YOUR_');

function getClient() {
  if (!clientPromise) {
    clientPromise = auth0.createAuth0Client({
      domain: authConfig.domain,
      clientId: authConfig.clientId,
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
      authorizationParams: {
        redirect_uri: location.origin + location.pathname,
        // `profile` and `email` are what let the server resolve a poster's name
        // from Auth0 /userinfo — an access token for a custom API audience does
        // not carry them itself.
        scope: 'openid profile email',
        ...(authConfig.audience ? {audience: authConfig.audience} : {}),
      },
    });
  }
  return clientPromise;
}

// Completes a login redirect if one is in progress, then reports the signed-in
// user (or null) and whether this page load completed a fresh login.
// Safe to call when Auth0 is not configured yet.
export async function initAuth() {
  if (!isConfigured()) return {user: null, freshLogin: false};
  const client = await getClient();
  const params = new URLSearchParams(location.search);
  let freshLogin = false;
  if (params.has('code') && params.has('state')) {
    try { await client.handleRedirectCallback(); freshLogin = true; } catch { /* stale or reused callback URL */ }
    history.replaceState(null, '', location.pathname + location.hash);
  }
  const user = (await client.isAuthenticated()) ? await client.getUser() : null;
  return {user, freshLogin};
}

export async function login() { await (await getClient()).loginWithRedirect(); }

export async function logout() {
  await (await getClient()).logout({logoutParams: {returnTo: location.origin + location.pathname}});
}

// For calling protected /api/* routes: fetch(url, {headers: await authHeader()})
export async function authHeader() {
  return {Authorization: `Bearer ${await (await getClient()).getTokenSilently()}`};
}

// Where /api/* lives: the VPS in production, but always the local server when
// the page itself is served from localhost. Without this, `npm run dev` would
// silently exercise the deployed API — so a route added locally looks like a
// 404 until it ships.
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const apiOrigin = () => (isLocal ? '' : authConfig.apiBase || '');

// Calls the API server (same origin locally, the VPS from GitHub Pages) with auth.
export async function apiFetch(path, options = {}) {
  const headers = {...(options.headers || {}), ...(await authHeader())};
  return fetch(`${apiOrigin()}${path}`, {...options, headers});
}
