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

// Calls the API server (same origin locally, the VPS from GitHub Pages) with auth.
export async function apiFetch(path, options = {}) {
  const headers = {...(options.headers || {}), ...(await authHeader())};
  return fetch(`${authConfig.apiBase || ''}${path}`, {...options, headers});
}
