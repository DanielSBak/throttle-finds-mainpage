import * as SecureStore from 'expo-secure-store';
import { OWNER, REPO, BRANCH, GITHUB_OAUTH_CLIENT_ID } from './config';
import { decodeBase64, encodeBase64 } from './base64';

const TOKEN_KEY = 'github_token';
const API = 'https://api.github.com';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: token ? `Bearer ${token}` : '',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  return res;
}

/** True when the stored token can access the inventory repository. */
export async function validateToken(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  const res = await api(`/repos/${OWNER}/${REPO}`);
  return res.ok;
}

export interface RepoFile {
  name: string;
  path: string;
  sha: string;
}

export async function listDir(path: string): Promise<RepoFile[]> {
  const res = await api(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub: failed to list ${path} (${res.status})`);
  const items = (await res.json()) as Array<RepoFile & { type: string }>;
  return items.filter((i) => i.type === 'file');
}

export async function getTextFile(path: string): Promise<{ text: string; sha: string }> {
  const res = await api(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`);
  if (!res.ok) throw new Error(`GitHub: failed to read ${path} (${res.status})`);
  const data = (await res.json()) as { content: string; sha: string };
  return { text: decodeBase64(data.content), sha: data.sha };
}

async function putBase64(path: string, contentBase64: string, message: string, sha?: string): Promise<string> {
  const res = await api(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: contentBase64, branch: BRANCH, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub: failed to save ${path} (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content: { sha: string } };
  return data.content.sha;
}

export async function putTextFile(path: string, text: string, message: string, sha?: string): Promise<string> {
  return putBase64(path, encodeBase64(text), message, sha);
}

export async function putBinaryFile(path: string, base64: string, message: string, sha?: string): Promise<string> {
  return putBase64(path, base64, message, sha);
}

export async function deleteFile(path: string, sha: string, message: string): Promise<void> {
  const res = await api(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
  if (!res.ok) throw new Error(`GitHub: failed to delete ${path} (${res.status})`);
}

// ---------- Optional GitHub device-flow sign in ----------

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
}

export async function startDeviceFlow(): Promise<DeviceCode> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_OAUTH_CLIENT_ID, scope: 'repo' }),
  });
  if (!res.ok) throw new Error('GitHub: could not start device sign-in');
  return (await res.json()) as DeviceCode;
}

/** Polls until the user authorizes the device; resolves with the token. */
export async function pollDeviceFlow(device: DeviceCode, signal?: { cancelled: boolean }): Promise<string> {
  const intervalMs = Math.max(device.interval, 5) * 1000;
  for (;;) {
    await new Promise((r) => setTimeout(r, intervalMs));
    if (signal?.cancelled) throw new Error('cancelled');
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_OAUTH_CLIENT_ID,
        device_code: device.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = (await res.json()) as { access_token?: string; error?: string };
    if (data.access_token) return data.access_token;
    if (data.error && data.error !== 'authorization_pending' && data.error !== 'slow_down') {
      throw new Error(`GitHub sign-in failed: ${data.error}`);
    }
  }
}
