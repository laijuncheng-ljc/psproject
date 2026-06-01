import { Buffer } from "node:buffer";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const BOARD_FILE_NAME = "board.md";
const EXAMPLE_FILE_NAME = "example-board.md";
const BACKUP_DIR_NAME = "backups";
const BOARD_API_PATH = "/api/board";
const BACKUPS_API_PATH = "/api/board/backups";
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;

interface BackupSnapshot {
  fileName: string;
  path: string;
  createdAt: string;
  size: number;
}

class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localBoardFilePlugin()],
  build: {
    cssMinify: false,
  },
});

function localBoardFilePlugin(): Plugin {
  const root = process.cwd();
  const boardFilePath = path.join(root, BOARD_FILE_NAME);
  const exampleFilePath = path.join(root, EXAMPLE_FILE_NAME);
  const backupDirectoryPath = path.join(root, BACKUP_DIR_NAME);

  const middleware = (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ) => {
    void handleRequest(request, response, next);
  };

  async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ) {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (url.pathname === BOARD_API_PATH && request.method === "GET") {
      await respond(response, async () => {
        await ensureBoardFile(boardFilePath, exampleFilePath);
        const content = await readFile(boardFilePath, "utf8");

        return {
          fileName: BOARD_FILE_NAME,
          path: BOARD_FILE_NAME,
          content,
          backups: await listBackups(backupDirectoryPath),
        };
      });
      return;
    }

    if (url.pathname === BOARD_API_PATH && request.method === "PUT") {
      await respond(response, async () => {
        const content = getContentFromBody(await readJsonBody(request));

        await ensureBoardFile(boardFilePath, exampleFilePath);
        await writeFile(boardFilePath, content, "utf8");

        return {
          fileName: BOARD_FILE_NAME,
          path: BOARD_FILE_NAME,
          savedAt: new Date().toISOString(),
        };
      });
      return;
    }

    if (url.pathname === BACKUPS_API_PATH && request.method === "GET") {
      await respond(response, () => listBackups(backupDirectoryPath));
      return;
    }

    if (url.pathname === BACKUPS_API_PATH && request.method === "POST") {
      await respond(response, async () => {
        const content = getContentFromBody(await readJsonBody(request));
        const backup = await writeBackup(backupDirectoryPath, content);

        return { backup };
      });
      return;
    }

    next();
  }

  return {
    name: "local-board-file",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

async function ensureBoardFile(
  boardFilePath: string,
  exampleFilePath: string,
): Promise<void> {
  try {
    await readFile(boardFilePath, "utf8");
  } catch (error) {
    if (!hasCode(error, "ENOENT")) {
      throw error;
    }

    try {
      await copyFile(exampleFilePath, boardFilePath);
    } catch (copyError) {
      if (!hasCode(copyError, "ENOENT")) {
        throw copyError;
      }

      await writeFile(
        boardFilePath,
        "# 个人看板\n\n## 待办\n\n## 进行中\n\n## 已完成\n",
        "utf8",
      );
    }
  }
}

async function writeBackup(
  backupDirectoryPath: string,
  content: string,
): Promise<BackupSnapshot> {
  await mkdir(backupDirectoryPath, { recursive: true });

  const fileName = `board-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
  const backupFilePath = path.join(backupDirectoryPath, fileName);

  await writeFile(backupFilePath, content, "utf8");

  const backupStat = await stat(backupFilePath);
  return {
    fileName,
    path: `${BACKUP_DIR_NAME}/${fileName}`,
    createdAt: backupStat.mtime.toISOString(),
    size: backupStat.size,
  };
}

async function listBackups(
  backupDirectoryPath: string,
): Promise<BackupSnapshot[]> {
  let fileNames: string[];

  try {
    fileNames = await readdir(backupDirectoryPath);
  } catch (error) {
    if (hasCode(error, "ENOENT")) {
      return [];
    }

    throw error;
  }

  const snapshots = await Promise.all(
    fileNames
      .filter((fileName) => fileName.startsWith("board-") && fileName.endsWith(".md"))
      .map(async (fileName) => {
        const backupFilePath = path.join(backupDirectoryPath, fileName);
        const backupStat = await stat(backupFilePath);

        return {
          fileName,
          path: `${BACKUP_DIR_NAME}/${fileName}`,
          createdAt: backupStat.mtime.toISOString(),
          size: backupStat.size,
        };
      }),
  );

  return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > MAX_REQUEST_BYTES) {
      throw new ApiError(413, "Markdown 文件内容过大，无法保存。");
    }

    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, "请求内容不是有效的 JSON。");
  }
}

function getContentFromBody(body: unknown): string {
  if (typeof body !== "object" || body === null || !("content" in body)) {
    throw new ApiError(400, "缺少 Markdown 内容。");
  }

  const content = (body as { content?: unknown }).content;

  if (typeof content !== "string") {
    throw new ApiError(400, "Markdown 内容格式不正确。");
  }

  return content;
}

async function respond(
  response: ServerResponse,
  getPayload: () => unknown | Promise<unknown>,
): Promise<void> {
  try {
    sendJson(response, 200, await getPayload());
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message =
      error instanceof Error ? error.message : "固定 Markdown 文件读写失败。";

    sendJson(response, statusCode, { message });
  }
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
