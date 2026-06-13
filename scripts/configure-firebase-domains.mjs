import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { exchangeServiceAccountCredentials } from './deploy-firestore-rules.mjs';

const HOSTING_API_ROOT = 'https://firebasehosting.googleapis.com/v1beta1';
const AUTH_API_ROOT = 'https://identitytoolkit.googleapis.com/admin/v2';

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function apiRequest(url, accessToken, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  const body = await readJson(response);
  return { response, body };
}

function assertDomain(domain) {
  if (
    typeof domain !== 'string' ||
    domain !== domain.toLowerCase() ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
  ) {
    throw new Error(`Invalid domain: ${domain}`);
  }
}

function apiError(body, status, service) {
  return new Error(body?.error?.message || `${service} API returned ${status}.`);
}

export async function getCustomDomain({
  projectId,
  siteId,
  domain,
  accessToken,
  fetchImpl = fetch,
}) {
  assertDomain(domain);
  const name = `projects/${projectId}/sites/${siteId}/customDomains/${domain}`;
  const { response, body } = await apiRequest(
    `${HOSTING_API_ROOT}/${name}`,
    accessToken,
    {},
    fetchImpl,
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw apiError(body, response.status, 'Firebase Hosting');
  }
  return body;
}

export async function ensureCustomDomain({
  projectId,
  siteId,
  domain,
  redirectTarget,
  accessToken,
  fetchImpl = fetch,
}) {
  const existing = await getCustomDomain({
    projectId,
    siteId,
    domain,
    accessToken,
    fetchImpl,
  });
  if (existing) {
    return { created: false, domain: existing };
  }

  const parent = `projects/${projectId}/sites/${siteId}`;
  const body = redirectTarget ? { redirectTarget } : {};
  const { response, body: operation } = await apiRequest(
    `${HOSTING_API_ROOT}/${parent}/customDomains?customDomainId=${encodeURIComponent(domain)}`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    fetchImpl,
  );
  if (!response.ok) {
    throw apiError(operation, response.status, 'Firebase Hosting');
  }

  return { created: true, operation };
}

export async function ensureAuthorizedDomains({
  projectId,
  domains,
  accessToken,
  fetchImpl = fetch,
}) {
  domains.forEach(assertDomain);
  const configUrl = `${AUTH_API_ROOT}/projects/${projectId}/config`;
  const { response, body: config } = await apiRequest(
    configUrl,
    accessToken,
    {},
    fetchImpl,
  );
  if (!response.ok) {
    throw apiError(config, response.status, 'Firebase Auth');
  }

  const authorizedDomains = [...new Set([...(config.authorizedDomains || []), ...domains])].sort();
  if (
    authorizedDomains.length === (config.authorizedDomains || []).length &&
    domains.every((domain) => config.authorizedDomains.includes(domain))
  ) {
    return { updated: false, authorizedDomains };
  }

  const { response: updateResponse, body: updatedConfig } = await apiRequest(
    `${configUrl}?updateMask=authorizedDomains`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({
        name: `projects/${projectId}/config`,
        authorizedDomains,
      }),
    },
    fetchImpl,
  );
  if (!updateResponse.ok) {
    throw apiError(updatedConfig, updateResponse.status, 'Firebase Auth');
  }

  return {
    updated: true,
    authorizedDomains: updatedConfig.authorizedDomains || authorizedDomains,
  };
}

export function summarizeCustomDomain(domain) {
  if (!domain) {
    return null;
  }
  return {
    name: domain.name,
    hostState: domain.hostState,
    ownershipState: domain.ownershipState,
    reconciling: domain.reconciling,
    cert: domain.cert
      ? {
          state: domain.cert.state,
          expireTime: domain.cert.expireTime,
        }
      : null,
    redirectTarget: domain.redirectTarget,
    requiredDnsUpdates: domain.requiredDnsUpdates,
    issues: domain.issues,
  };
}

async function loadAccessToken() {
  if (process.env.GOOGLE_OAUTH_ACCESS_TOKEN) {
    return process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  }
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required.');
  }
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  return exchangeServiceAccountCredentials({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/firebase',
      'https://www.googleapis.com/auth/cloud-platform',
    ],
  });
}

async function main() {
  const mode = process.argv[2] || 'status';
  if (!['prepare', 'status'].includes(mode)) {
    throw new Error('Usage: node scripts/configure-firebase-domains.mjs [prepare|status]');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const siteId = process.env.FIREBASE_SITE_ID || projectId;
  const primaryDomain = process.env.PRIMARY_DOMAIN;
  if (!projectId || !siteId || !primaryDomain) {
    throw new Error('FIREBASE_PROJECT_ID, FIREBASE_SITE_ID, and PRIMARY_DOMAIN are required.');
  }

  assertDomain(primaryDomain);
  const wwwDomain = `www.${primaryDomain}`;
  const accessToken = await loadAccessToken();
  const result = { mode, projectId, siteId, domains: {}, auth: null };

  if (mode === 'prepare') {
    result.domains[primaryDomain] = await ensureCustomDomain({
      projectId,
      siteId,
      domain: primaryDomain,
      accessToken,
    });
    result.domains[wwwDomain] = await ensureCustomDomain({
      projectId,
      siteId,
      domain: wwwDomain,
      redirectTarget: primaryDomain,
      accessToken,
    });
    result.auth = await ensureAuthorizedDomains({
      projectId,
      domains: [primaryDomain, wwwDomain],
      accessToken,
    });
  }

  for (const domain of [primaryDomain, wwwDomain]) {
    const state = await getCustomDomain({
      projectId,
      siteId,
      domain,
      accessToken,
    });
    result.domains[domain] = {
      ...result.domains[domain],
      state: summarizeCustomDomain(state),
    };
  }

  console.log(JSON.stringify(result, null, 2));
}

const isEntrypoint =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  await main();
}
