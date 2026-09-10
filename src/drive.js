const CLIENT_ID = "476743396688-j72sbq4oaegmcjkm4flqcpgnb24u52bi.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const BACKUP_FILENAME = "cuentita-backup.json";

let _tokenClient = null;
let _accessToken = null;

export const isDriveAvailable = () =>
  typeof window !== "undefined" && !!window.google?.accounts?.oauth2;

export function initDrive(onToken) {
  if (!isDriveAvailable()) return;
  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (resp) => {
      _accessToken = resp.access_token || null;
      onToken(!!_accessToken);
    },
  });
}

export function requestDriveAccess() {
  if (!_tokenClient) throw new Error("Drive no inicializado.");
  _tokenClient.requestAccessToken();
}

export function disconnectDrive() {
  if (_accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(_accessToken);
  }
  _accessToken = null;
}

export const isConnected = () => !!_accessToken;

async function driveReq(path, opts = {}) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${_accessToken}`, ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  return res;
}

async function findFile() {
  const res = await driveReq(
    `files?q=name='${BACKUP_FILENAME}' and trashed=false&fields=files(id)&spaces=drive`
  );
  const { files } = await res.json();
  return files?.[0] || null;
}

export async function uploadToDrive(backupObj) {
  if (!_accessToken) throw new Error("No conectado a Drive.");
  const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
  const existing = await findFile();
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({ name: BACKUP_FILENAME })], { type: "application/json" }));
  form.append("file", blob);
  if (existing) {
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`,
      { method: "PATCH", headers: { Authorization: `Bearer ${_accessToken}` }, body: form }
    );
  } else {
    await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      { method: "POST", headers: { Authorization: `Bearer ${_accessToken}` }, body: form }
    );
  }
}

export async function downloadFromDrive() {
  if (!_accessToken) throw new Error("No conectado a Drive.");
  const file = await findFile();
  if (!file) throw new Error("No se encontró el archivo de backup en Drive.");
  const res = await driveReq(`files/${file.id}?alt=media`);
  return res.json();
}
