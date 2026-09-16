import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { OWNER, REPO, BRANCH, GITHUB_OAUTH_CLIENT_ID } from './config';
import { decodeBase64, decodeBase64Bytes, encodeBase64 } from './base64';

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

export class GitHubError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function responseError(res: Response): GitHubError {
  const message = res.status === 401 ? 'Your GitHub token is no longer valid. Sign out and sign in with a new token. Your draft stays on this phone.'
    : res.status === 403 || res.status === 429 ? (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429 || res.headers.get('retry-after')
      ? 'GitHub is limiting requests. Wait a few minutes and try again. Your draft is saved.'
      : 'GitHub denied this change. Check your collaborator access and the token’s write permission.')
    : res.status === 409 || res.status === 422 ? 'This listing changed on GitHub. Go back, refresh inventory and reopen it before making further changes. Your draft is saved.'
    : res.status === 404 ? 'The file or repository is unavailable. Check access and refresh inventory.'
    : `GitHub could not complete the request (${res.status}). Please try again. Your draft is saved.`;
  return new GitHubError(res.status, message);
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  if (!token) throw new GitHubError(401, 'Sign in with your GitHub token before publishing.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new GitHubError(0, 'Connection interrupted or timed out. Check your internet and retry. Uploaded photos will be reused.');
  } finally {
    clearTimeout(timer);
  }
}

const contentPath = (path: string) => `/repos/${OWNER}/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

interface FileData { sha: string; content?: string }
async function readFile(path: string): Promise<FileData | null> {
  const res = await api(`${contentPath(path)}?ref=${encodeURIComponent(BRANCH)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw responseError(res);
  return await res.json() as FileData;
}

/** Git's blob SHA lets retries recognize successful writes, even if the response was lost. */
export async function blobSha(base64: string): Promise<string> {
  const body = decodeBase64Bytes(base64);
  const header = `blob ${body.length}\0`;
  const bytes = new Uint8Array(header.length + body.length);
  for (let i = 0; i < header.length; i++) bytes[i] = header.charCodeAt(i);
  bytes.set(body, header.length);
  const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA1, bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** True when the stored token can access the inventory repository. */
export async function validateToken(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  const res = await api(`/repos/${OWNER}/${REPO}`);
  if (res.status === 401) return false;
  if (!res.ok) throw responseError(res);
  const repo = await res.json() as { permissions?: { push?: boolean } };
  return repo.permissions?.push === true;
}

export interface RepoFile {
  name: string;
  path: string;
  sha: string;
}

export async function listDir(path: string): Promise<RepoFile[]> {
  const res = await api(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
  if (!res.ok) throw responseError(res);
  const items = (await res.json()) as Array<RepoFile & { type: string }>;
  return items.filter((i) => i.type === 'file');
}

export async function getTextFile(path: string): Promise<{ text: string; sha: string }> {
  const file = await readFile(path);
  if (!file || file.content === undefined) throw new Error('Listing unavailable. Refresh inventory and try again.');
  return { text: decodeBase64(file.content), sha: file.sha };
}

async function putBase64(path: string, contentBase64: string, message: string, sha?: string): Promise<string> {
  const targetSha = await blobSha(contentBase64);
  for (let attempt = 0; attempt < 3; attempt++) {
    // Never blindly retry a mutation: the previous request may already have committed.
    const current = await readFile(path);
    if (current?.sha === targetSha) return targetSha;
    if ((current?.sha ?? undefined) !== sha) throw new GitHubError(409, 'This listing changed on GitHub. Go back, refresh and reopen it. Choose the latest version when prompted; your saved draft has not been overwritten.');
    try {
      const res = await api(contentPath(path), {
        method: 'PUT',
        body: JSON.stringify({ message, content: contentBase64, branch: BRANCH, ...(sha ? { sha } : {}) }),
      });
      if (!res.ok) throw responseError(res);
      return targetSha;
    } catch (e) {
      const retryable = e instanceof GitHubError && (e.status === 0 || e.status === 409 || e.status === 422 || e.status >= 500);
      if (!retryable) throw e;
      if (attempt === 2) {
        // A final successful write with a lost response is still a success.
        if ((await readFile(path))?.sha === targetSha) return targetSha;
        throw e;
      }
      await pause(1000 * (attempt + 1));
    }
  }
  throw new Error('Please retry publishing.');
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
  if (!res.ok) throw responseError(res);
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
