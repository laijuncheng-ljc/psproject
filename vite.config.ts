import { Buffer } from "node:buffer";
import type { Dirent } from "node:fs";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const BOARD_FILE_NAME = "board.md";
const EXAMPLE_FILE_NAME = "example-board.md";
const PROJECT_DATA_DIR_NAME = "project-data";
const BACKUP_DIR_NAME = "backups";
const LEGACY_CARD_DETAIL_DIR_NAME = "card-details";
const CARD_DETAIL_DIR_NAME = "details";
const BOARD_API_PATH = "/api/board";
const BACKUPS_API_PATH = "/api/board/backups";
const CARD_DETAIL_API_PATH = "/api/card-detail";
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;

interface BackupSnapshot {
  fileName: string;
  path: string;
  createdAt: string;
  size: number;
}

interface SupportDocPayload {
  path: string;
  content: string;
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
  base: process.env.GITHUB_PAGES === "true" ? "/psproject/" : "/",
  plugins: [react(), localBoardFilePlugin()],
  build: {
    cssMinify: false,
  },
});

function localBoardFilePlugin(): Plugin {
  const root = process.cwd();
  const projectDataDirectoryPath = path.join(root, PROJECT_DATA_DIR_NAME);
  const boardFilePath = path.join(projectDataDirectoryPath, BOARD_FILE_NAME);
  const legacyBoardFilePath = path.join(root, BOARD_FILE_NAME);
  const exampleFilePath = path.join(root, EXAMPLE_FILE_NAME);
  const backupDirectoryPath = path.join(projectDataDirectoryPath, BACKUP_DIR_NAME);

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
        await ensureProjectData(
          projectDataDirectoryPath,
          boardFilePath,
          legacyBoardFilePath,
          exampleFilePath,
          root,
        );
        const content = await readFile(boardFilePath, "utf8");

        return {
          fileName: `${PROJECT_DATA_DIR_NAME}/${BOARD_FILE_NAME}`,
          path: `${PROJECT_DATA_DIR_NAME}/${BOARD_FILE_NAME}`,
          content,
          backups: await listBackups(backupDirectoryPath),
        };
      });
      return;
    }

    if (url.pathname === BOARD_API_PATH && request.method === "PUT") {
      await respond(response, async () => {
        const body = await readJsonBody(request);
        const content = getContentFromBody(body);

        await ensureProjectData(
          projectDataDirectoryPath,
          boardFilePath,
          legacyBoardFilePath,
          exampleFilePath,
          root,
        );
        await writeFile(boardFilePath, content, "utf8");
        await writeSupportDocs(root, getSupportDocsFromBody(body));

        return {
          fileName: `${PROJECT_DATA_DIR_NAME}/${BOARD_FILE_NAME}`,
          path: `${PROJECT_DATA_DIR_NAME}/${BOARD_FILE_NAME}`,
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

    if (url.pathname === CARD_DETAIL_API_PATH && request.method === "GET") {
      await respond(response, async () => {
        const detailPath = normalizeCardDetailPath(url.searchParams.get("path"));
        const detailFilePath = path.join(root, detailPath);

        try {
          return {
            path: detailPath,
            content: await readFile(detailFilePath, "utf8"),
            exists: true,
          };
        } catch (error) {
          if (!hasCode(error, "ENOENT")) {
            throw error;
          }

          return {
            path: detailPath,
            content: "",
            exists: false,
          };
        }
      });
      return;
    }

    if (url.pathname === CARD_DETAIL_API_PATH && request.method === "PUT") {
      await respond(response, async () => {
        const body = await readJsonBody(request);
        const detailPath = normalizeCardDetailPath(getPathFromBody(body));
        const content = getContentFromBody(body);
        const detailFilePath = path.join(root, detailPath);

        await mkdir(path.dirname(detailFilePath), { recursive: true });
        await writeFile(detailFilePath, content, "utf8");

        return {
          path: detailPath,
          savedAt: new Date().toISOString(),
        };
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
    async generateBundle() {
      await emitProjectDataAssets(root, (fileName, source) => {
        this.emitFile({
          type: "asset",
          fileName,
          source,
        });
      });
    },
  };
}

async function emitProjectDataAssets(
  root: string,
  emitAsset: (fileName: string, source: string) => void,
): Promise<void> {
  const projectDataDirectoryPath = path.join(root, PROJECT_DATA_DIR_NAME);

  await emitDirectoryAssets(projectDataDirectoryPath, PROJECT_DATA_DIR_NAME, emitAsset);
}

async function emitDirectoryAssets(
  directoryPath: string,
  outputPrefix: string,
  emitAsset: (fileName: string, source: string) => void,
): Promise<void> {
  let entries: Dirent<string>[];

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (hasCode(error, "ENOENT")) {
      return;
    }

    throw error;
  }

  for (const entry of entries) {
    if (entry.name === BACKUP_DIR_NAME || entry.name.startsWith(".")) {
      continue;
    }

    const filePath = path.join(directoryPath, entry.name);
    const outputPath = `${outputPrefix}/${entry.name}`;

    if (entry.isDirectory()) {
      await emitDirectoryAssets(filePath, outputPath, emitAsset);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    emitAsset(outputPath, await readFile(filePath, "utf8"));
  }
}

async function ensureProjectData(
  projectDataDirectoryPath: string,
  boardFilePath: string,
  legacyBoardFilePath: string,
  exampleFilePath: string,
  root: string,
): Promise<void> {
  await mkdir(path.join(projectDataDirectoryPath, CARD_DETAIL_DIR_NAME), {
    recursive: true,
  });

  try {
    await readFile(boardFilePath, "utf8");
  } catch (error) {
    if (!hasCode(error, "ENOENT")) {
      throw error;
    }

    try {
      const legacyBoard = await readFile(legacyBoardFilePath, "utf8");
      await writeFile(boardFilePath, rewriteLegacyDetailPaths(legacyBoard), "utf8");
    } catch (legacyError) {
      if (!hasCode(legacyError, "ENOENT")) {
        throw legacyError;
      }

      try {
        const exampleBoard = await readFile(exampleFilePath, "utf8");
        await writeFile(boardFilePath, rewriteLegacyDetailPaths(exampleBoard), "utf8");
      } catch (copyError) {
        if (!hasCode(copyError, "ENOENT")) {
          throw copyError;
        }

        await writeFile(
          boardFilePath,
          "# 个人看板\n\n## 项目备注\n\n## 待办\n\n## 进行中\n\n## 已完成\n\n## 归档\n",
          "utf8",
        );
      }
    }
  }

  await migrateLegacyDetails(root, projectDataDirectoryPath);
  await ensureSupportDoc(
    path.join(projectDataDirectoryPath, "notes.md"),
    "# 项目备注\n\n记录项目目标、背景、阶段性结论和风险。\n",
  );
  await ensureSupportDoc(
    path.join(projectDataDirectoryPath, "resources.md"),
    "# 挖坑进度\n\n保存看板后会自动生成。\n",
  );
  await ensureSupportDoc(
    path.join(projectDataDirectoryPath, "achievements.md"),
    "# 挖坑记录\n\n保存看板后会自动生成。\n",
  );
}

async function writeSupportDocs(
  root: string,
  supportDocs: SupportDocPayload[],
): Promise<void> {
  for (const supportDoc of supportDocs) {
    const supportDocPath = normalizeSupportDocPath(supportDoc.path);
    const fullPath = path.join(root, supportDocPath);

    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, supportDoc.content, "utf8");
  }
}

async function ensureSupportDoc(filePath: string, fallbackContent: string) {
  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if (!hasCode(error, "ENOENT")) {
      throw error;
    }

    await writeFile(filePath, fallbackContent, "utf8");
  }
}

async function migrateLegacyDetails(
  root: string,
  projectDataDirectoryPath: string,
): Promise<void> {
  const legacyDetailPath = path.join(root, LEGACY_CARD_DETAIL_DIR_NAME);
  const detailDirectoryPath = path.join(projectDataDirectoryPath, CARD_DETAIL_DIR_NAME);

  try {
    await cp(legacyDetailPath, detailDirectoryPath, {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  } catch (error) {
    if (!hasCode(error, "ENOENT")) {
      throw error;
    }
  }
}

function rewriteLegacyDetailPaths(content: string): string {
  return content.replace(
    new RegExp(`${LEGACY_CARD_DETAIL_DIR_NAME}/`, "g"),
    `${PROJECT_DATA_DIR_NAME}/${CARD_DETAIL_DIR_NAME}/`,
  );
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

function getPathFromBody(body: unknown): string {
  if (typeof body !== "object" || body === null || !("path" in body)) {
    throw new ApiError(400, "缺少 Markdown 文件路径。");
  }

  const filePath = (body as { path?: unknown }).path;

  if (typeof filePath !== "string") {
    throw new ApiError(400, "Markdown 文件路径格式不正确。");
  }

  return filePath;
}

function getSupportDocsFromBody(body: unknown): SupportDocPayload[] {
  if (typeof body !== "object" || body === null || !("supportDocs" in body)) {
    return [];
  }

  const supportDocs = (body as { supportDocs?: unknown }).supportDocs;

  if (!Array.isArray(supportDocs)) {
    throw new ApiError(400, "辅助 Markdown 文档格式不正确。");
  }

  return supportDocs.map((supportDoc) => {
    if (
      typeof supportDoc !== "object" ||
      supportDoc === null ||
      typeof (supportDoc as { path?: unknown }).path !== "string" ||
      typeof (supportDoc as { content?: unknown }).content !== "string"
    ) {
      throw new ApiError(400, "辅助 Markdown 文档内容不正确。");
    }

    return {
      path: (supportDoc as { path: string }).path,
      content: (supportDoc as { content: string }).content,
    };
  });
}

function normalizeSupportDocPath(rawPath: string): string {
  const normalizedPath = path.posix.normalize(rawPath.trim().replace(/\\/g, "/"));
  const supportPath = normalizedPath.startsWith(`${PROJECT_DATA_DIR_NAME}/`)
    ? normalizedPath
    : `${PROJECT_DATA_DIR_NAME}/${normalizedPath}`;
  const allowedPaths = new Set([
    `${PROJECT_DATA_DIR_NAME}/notes.md`,
    `${PROJECT_DATA_DIR_NAME}/resources.md`,
    `${PROJECT_DATA_DIR_NAME}/achievements.md`,
  ]);

  if (!allowedPaths.has(supportPath)) {
    throw new ApiError(400, "辅助 Markdown 文档只能写入 project-data 的核心文件。");
  }

  return supportPath;
}

function normalizeCardDetailPath(rawPath: string | null): string {
  const cleanPath = (rawPath ?? "").trim().replace(/\\/g, "/");

  if (!cleanPath) {
    throw new ApiError(400, "缺少专项文档路径。");
  }

  const normalizedPath = path.posix.normalize(cleanPath);
  const legacyPrefix = `${LEGACY_CARD_DETAIL_DIR_NAME}/`;
  const projectDetailPrefix = `${PROJECT_DATA_DIR_NAME}/${CARD_DETAIL_DIR_NAME}/`;
  let detailPath = normalizedPath;

  if (detailPath.startsWith(legacyPrefix)) {
    detailPath = `${projectDetailPrefix}${detailPath.slice(legacyPrefix.length)}`;
  } else if (detailPath.startsWith(`${CARD_DETAIL_DIR_NAME}/`)) {
    detailPath = `${PROJECT_DATA_DIR_NAME}/${detailPath}`;
  } else if (!detailPath.startsWith(projectDetailPrefix)) {
    detailPath = `${projectDetailPrefix}${detailPath}`;
  }

  const segments = detailPath.split("/");

  if (
    segments[0] !== PROJECT_DATA_DIR_NAME ||
    segments[1] !== CARD_DETAIL_DIR_NAME ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
    path.posix.isAbsolute(detailPath) ||
    !detailPath.endsWith(".md")
  ) {
    throw new ApiError(400, "专项文档必须放在 project-data/details/ 目录下，并使用 .md 后缀。");
  }

  return segments.join("/");
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
