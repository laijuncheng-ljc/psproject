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

export interface SupportMarkdownDoc {
  path: string;
  content: string;
}

const BOARD_API_PATH = "/api/board";
const BACKUPS_API_PATH = "/api/board/backups";
const CARD_DETAIL_API_PATH = "/api/card-detail";
const STATIC_BOARD_PATH = "project-data/board.md";
const STATIC_BACKUPS_KEY = "local-md-kanban:static-backups";
const STATIC_BOARD_KEY = "local-md-kanban:static-board";
const STATIC_DETAIL_KEY_PREFIX = "local-md-kanban:static-detail:";

export async function loadFixedMarkdownFile(): Promise<FixedMarkdownFile> {
  try {
    return await requestJson<FixedMarkdownFile>(BOARD_API_PATH);
  } catch {
    return loadStaticMarkdownFile();
  }
}

export async function saveFixedMarkdownFile(
  content: string,
  supportDocs: SupportMarkdownDoc[] = [],
): Promise<SaveFixedMarkdownFileResult> {
  try {
    return await requestJson<SaveFixedMarkdownFileResult>(BOARD_API_PATH, {
      method: "PUT",
      body: JSON.stringify({ content, supportDocs }),
    });
  } catch {
    window.localStorage.setItem(STATIC_BOARD_KEY, content);
    for (const supportDoc of supportDocs) {
      window.localStorage.setItem(
        getStaticDetailStorageKey(supportDoc.path),
        supportDoc.content,
      );
    }

    return createStaticSaveResult(STATIC_BOARD_PATH);
  }
}

export async function createFixedMarkdownBackup(
  content: string,
): Promise<CreateBackupResult> {
  try {
    return await requestJson<CreateBackupResult>(BACKUPS_API_PATH, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  } catch {
    const backup: BackupSnapshot = {
      fileName: `board-${new Date().toISOString().replace(/[:.]/g, "-")}.md`,
      path: "browser-backups",
      createdAt: new Date().toISOString(),
      size: new Blob([content]).size,
    };
    const backups = [backup, ...readStaticBackups()].slice(0, 20);

    window.localStorage.setItem(STATIC_BACKUPS_KEY, JSON.stringify(backups));

    return { backup };
  }
}

export async function listFixedMarkdownBackups(): Promise<BackupSnapshot[]> {
  try {
    return await requestJson<BackupSnapshot[]>(BACKUPS_API_PATH);
  } catch {
    return readStaticBackups();
  }
}

export async function loadCardDetailFile(path: string): Promise<CardDetailFile> {
  const query = new URLSearchParams({ path });

  try {
    return await requestJson<CardDetailFile>(
      `${CARD_DETAIL_API_PATH}?${query.toString()}`,
    );
  } catch {
    const storedContent = window.localStorage.getItem(getStaticDetailStorageKey(path));

    if (storedContent !== null) {
      return { path, content: storedContent, exists: true };
    }

    const response = await fetch(toStaticAssetPath(path));

    if (!response.ok) {
      return { path, content: "", exists: false };
    }

    return {
      path,
      content: await response.text(),
      exists: true,
    };
  }
}

export async function saveCardDetailFile(
  path: string,
  content: string,
): Promise<SaveCardDetailFileResult> {
  try {
    return await requestJson<SaveCardDetailFileResult>(CARD_DETAIL_API_PATH, {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    });
  } catch {
    window.localStorage.setItem(getStaticDetailStorageKey(path), content);

    return createStaticSaveResult(path);
  }
}

async function loadStaticMarkdownFile(): Promise<FixedMarkdownFile> {
  const storedContent = window.localStorage.getItem(STATIC_BOARD_KEY);

  if (storedContent !== null) {
    return {
      fileName: STATIC_BOARD_PATH,
      path: STATIC_BOARD_PATH,
      content: storedContent,
      backups: readStaticBackups(),
    };
  }

  const response = await fetch(toStaticAssetPath(STATIC_BOARD_PATH));

  if (!response.ok) {
    throw new Error("线上 Markdown 看板读取失败。");
  }

  return {
    fileName: STATIC_BOARD_PATH,
    path: STATIC_BOARD_PATH,
    content: await response.text(),
    backups: readStaticBackups(),
  };
}

function readStaticBackups(): BackupSnapshot[] {
  const rawBackups = window.localStorage.getItem(STATIC_BACKUPS_KEY);

  if (!rawBackups) {
    return [];
  }

  try {
    const backups = JSON.parse(rawBackups) as unknown;

    if (!Array.isArray(backups)) {
      return [];
    }

    return backups.filter(isBackupSnapshot);
  } catch {
    return [];
  }
}

function createStaticSaveResult(path: string): SaveFixedMarkdownFileResult {
  const savedAt = new Date().toISOString();

  return {
    fileName: path,
    path,
    savedAt,
  };
}

function toStaticAssetPath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

function getStaticDetailStorageKey(path: string): string {
  return `${STATIC_DETAIL_KEY_PREFIX}${path}`;
}

function isBackupSnapshot(value: unknown): value is BackupSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as BackupSnapshot).fileName === "string" &&
    typeof (value as BackupSnapshot).path === "string" &&
    typeof (value as BackupSnapshot).createdAt === "string" &&
    typeof (value as BackupSnapshot).size === "number"
  );
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
