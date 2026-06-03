export interface BackupSnapshot {
  fileName: string;
  path: string;
  createdAt: string;
  size: number;
}

export interface FixedMarkdownFile {
  fileName: string;
  path: string;
  content: string;
  backups: BackupSnapshot[];
}

export interface SaveFixedMarkdownFileResult {
  fileName: string;
  path: string;
  savedAt: string;
}

export interface CreateBackupResult {
  backup: BackupSnapshot;
}

export interface CardDetailFile {
  path: string;
  content: string;
  exists: boolean;
}

export interface SaveCardDetailFileResult {
  path: string;
  savedAt: string;
}

const BOARD_API_PATH = "/api/board";
const BACKUPS_API_PATH = "/api/board/backups";
const CARD_DETAIL_API_PATH = "/api/card-detail";

export async function loadFixedMarkdownFile(): Promise<FixedMarkdownFile> {
  return requestJson<FixedMarkdownFile>(BOARD_API_PATH);
}

export async function saveFixedMarkdownFile(
  content: string,
): Promise<SaveFixedMarkdownFileResult> {
  return requestJson<SaveFixedMarkdownFileResult>(BOARD_API_PATH, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function createFixedMarkdownBackup(
  content: string,
): Promise<CreateBackupResult> {
  return requestJson<CreateBackupResult>(BACKUPS_API_PATH, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function listFixedMarkdownBackups(): Promise<BackupSnapshot[]> {
  return requestJson<BackupSnapshot[]>(BACKUPS_API_PATH);
}

export async function loadCardDetailFile(path: string): Promise<CardDetailFile> {
  const query = new URLSearchParams({ path });

  return requestJson<CardDetailFile>(`${CARD_DETAIL_API_PATH}?${query.toString()}`);
}

export async function saveCardDetailFile(
  path: string,
  content: string,
): Promise<SaveCardDetailFileResult> {
  return requestJson<SaveCardDetailFileResult>(CARD_DETAIL_API_PATH, {
    method: "PUT",
    body: JSON.stringify({ path, content }),
  });
}

async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : "固定 Markdown 文件读写失败。",
    );
  }

  return payload as T;
}
