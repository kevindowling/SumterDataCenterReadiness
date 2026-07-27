import {authConfig} from './auth-config.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2/dist/auth0-spa-js.production.js';

let clientPromise = null;
let sdkPromise = null;

export const isConfigured = () =>
  !authConfig.domain.startsWith('YOUR_') && !authConfig.clientId.startsWith('YOUR_');

// The SDK is ~100 KB from a third-party CDN and most readers never sign in, so
// it is no longer in the document head. It loads on the first thing that
// actually needs it: a sign-in, a returning session, or an API call.
function loadSdk() {
  if (typeof auth0 !== 'undefined') return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Auth0 SDK failed to load'));
      document.head.append(script);
    });
  }
  return sdkPromise;
}

// True when this browser has an Auth0 session cached. Lets a signed-out reader
// skip the SDK entirely rather than downloading it to be told they are signed
// out. Matches the key auth0-spa-js writes under cacheLocation: 'localstorage'.
function hasStoredSession() {
  try {
    const prefix = `@@auth0spajs@@::${authConfig.clientId}`;
    return Object.keys(localStorage).some((key) => key.startsWith(prefix));
  } catch { return false; } // private mode
}

async function getClient() {
  await loadSdk();
  if (!clientPromise) {
    clientPromise = auth0.createAuth0Client({
      domain: authConfig.domain,
      clientId: authConfig.clientId,
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
      authorizationParams: {
        // Always the site root, never the current path. Auth0 matches callback
        // URLs exactly against the registered list, so now that notes live at
        // their own paths, signing in from /doc/records/ would be rejected as a
        // callback mismatch. app.js sends a fresh login on to the community
        // desk from here.
        redirect_uri: `${location.origin}/`,
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
  const params = new URLSearchParams(location.search);
  const returning = params.has('code') && params.has('state');
  // Nothing to restore and nothing to complete: leave the SDK unloaded.
  if (!returning && !hasStoredSession()) return {user: null, freshLogin: false};
  const client = await getClient();
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
  await (await getClient()).logout({logoutParams: {returnTo: `${location.origin}/`}}); // registered logout URL, same reason as above
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
