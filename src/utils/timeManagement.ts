import type { ColumnId } from "../types/board";

export interface TimeManagementItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
}

export type StageId = ColumnId | "archived";

export interface StageHistoryEntry {
  id: string;
  stage: StageId;
  timestamp: string;
}

export interface ParsedTimeManagement {
  body: string;
  items: TimeManagementItem[];
  history: StageHistoryEntry[];
}

const SECTION_TITLE = "时间管理";
const SECTION_HEADING = `#### ${SECTION_TITLE}`;
const HISTORY_HEADING = "##### 环节记录";
const SUBITEM_HEADING = "##### 子项目";
const TASK_PATTERN =
  /^(\s*)[-*]\s+\[([ xX])\]\s+(.*?)(?:\s+<!--\s*completed_at:\s*(.*?)\s*-->)?\s*$/;
const HISTORY_PATTERN =
  /^(\s*)[-*]\s+(.+?)\s+进入(.+?)(?:\s+<!--\s*stage:\s*(.*?)\s*-->)?\s*$/;
const FENCE_PATTERN = /^ {0,3}(```+|~~~+)/;
const STAGE_LABELS: Record<StageId, string> = {
  todo: "待办",
  doing: "进行中",
  done: "已完成",
  archived: "归档",
};

export function parseTimeManagementSection(body: string): ParsedTimeManagement {
  const lines = normalizeLineEndings(body).split("\n");
  const sectionStart = findTimeManagementSectionStart(lines);

  if (sectionStart === -1) {
    return {
      body: trimBlankEdges(lines).join("\n"),
      items: [],
      history: [],
    };
  }

  const headingLevel = getHeadingLevel(lines[sectionStart]) ?? 4;
  const sectionEnd = findSectionEnd(lines, sectionStart + 1, headingLevel);
  const bodyWithoutSection = [
    ...lines.slice(0, sectionStart),
    ...lines.slice(sectionEnd),
  ];
  const sectionLines = lines.slice(sectionStart + 1, sectionEnd);

  return {
    body: trimBlankEdges(bodyWithoutSection).join("\n"),
    items: sectionLines.flatMap((line, index) => parseTaskLine(line, index)),
    history: sectionLines.flatMap((line, index) => parseHistoryLine(line, index)),
  };
}

export function serializeTimeManagementSection(
  body: string,
  items: TimeManagementItem[],
  history: StageHistoryEntry[] = [],
): string {
  const cleanBody = trimBlankEdges(normalizeLineEndings(body).split("\n")).join("\n");
  const visibleItems = items.filter((item) => item.title.trim() !== "");
  const visibleHistory = history.filter((entry) => entry.timestamp.trim() !== "");

  if (visibleItems.length === 0 && visibleHistory.length === 0) {
    return cleanBody;
  }

  const sectionBlocks: string[] = [];

  if (visibleHistory.length > 0) {
    sectionBlocks.push(
      `${HISTORY_HEADING}\n\n${visibleHistory
        .map((entry) => {
          const stage = normalizeStage(entry.stage);

          return `- ${entry.timestamp.trim()} 进入${STAGE_LABELS[stage]} <!-- stage: ${stage} -->`;
        })
        .join("\n")}`,
    );
  }

  if (visibleItems.length > 0) {
    const taskLines = visibleItems.map((item) => {
      const checkbox = item.completed ? "x" : " ";
      const timestamp =
        item.completed && item.completedAt
          ? ` <!-- completed_at: ${item.completedAt} -->`
          : "";

      return `- [${checkbox}] ${item.title.trim()}${timestamp}`;
    });
    sectionBlocks.push(`${SUBITEM_HEADING}\n\n${taskLines.join("\n")}`);
  }

  const sectionBlock = `${SECTION_HEADING}\n\n${sectionBlocks.join("\n\n")}`;

  return cleanBody ? `${cleanBody}\n\n${sectionBlock}` : sectionBlock;
}

export function appendStageHistory(
  body: string,
  stage: StageId,
  timestamp = formatLocalTimestamp(),
): string {
  const parsed = parseTimeManagementSection(body);
  const normalizedStage = normalizeStage(stage);
  const lastEntry = parsed.history.at(-1);

  if (lastEntry?.stage === normalizedStage) {
    return body;
  }

  return serializeTimeManagementSection(parsed.body, parsed.items, [
    ...parsed.history,
    {
      id: createStageHistoryId(),
      stage: normalizedStage,
      timestamp,
    },
  ]);
}

export function createTimeManagementItem(title: string): TimeManagementItem {
  return {
    id: createTimeManagementItemId(),
    title,
    completed: false,
    completedAt: null,
  };
}

export function formatLocalTimestamp(date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffset / 60);
  const offsetRemainder = absoluteOffset % 60;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}${sign}${pad(offsetHours)}:${pad(offsetRemainder)}`;
}

function parseTaskLine(line: string, index: number): TimeManagementItem[] {
  const match = TASK_PATTERN.exec(line);

  if (!match) {
    return [];
  }

  return [
    {
      id: `time-item-${index}`,
      title: match[3].trim(),
      completed: match[2].toLowerCase() === "x",
      completedAt: match[4]?.trim() ?? null,
    },
  ];
}

function parseHistoryLine(line: string, index: number): StageHistoryEntry[] {
  const match = HISTORY_PATTERN.exec(line);

  if (!match) {
    return [];
  }

  const stage = normalizeStage(match[4] || match[3]);

  return [
    {
      id: `stage-history-${index}`,
      stage,
      timestamp: match[2].trim(),
    },
  ];
}

function findTimeManagementSectionStart(lines: string[]): number {
  let insideFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!insideFence && isTimeManagementHeading(line)) {
      return index;
    }

    if (isFenceLine(line)) {
      insideFence = !insideFence;
    }
  }

  return -1;
}

function findSectionEnd(
  lines: string[],
  startIndex: number,
  sectionHeadingLevel: number,
): number {
  let insideFence = false;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    const headingLevel = getHeadingLevel(line);

    if (!insideFence && headingLevel !== null && headingLevel <= sectionHeadingLevel) {
      return index;
    }

    if (isFenceLine(line)) {
      insideFence = !insideFence;
    }
  }

  return lines.length;
}

function isTimeManagementHeading(line: string): boolean {
  return /^#{1,6}\s+(Time Management|时间管理)\s*$/i.test(line.trim());
}

function getHeadingLevel(line: string): number | null {
  const match = /^(#{1,6})\s+/.exec(line.trim());
  return match ? match[1].length : null;
}

function isFenceLine(line: string): boolean {
  return FENCE_PATTERN.test(line);
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === "") {
    start += 1;
  }

  while (end > start && lines[end - 1].trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function createTimeManagementItemId(): string {
  const randomPart =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);

  return `time-item-${randomPart}`;
}

function createStageHistoryId(): string {
  const randomPart =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);

  return `stage-history-${randomPart}`;
}

function normalizeStage(value: string): StageId {
  const normalized = String(value).trim().toLowerCase();

  if (normalized === "todo" || normalized === "待办") {
    return "todo";
  }

  if (normalized === "doing" || normalized === "进行中") {
    return "doing";
  }

  if (normalized === "done" || normalized === "已完成") {
    return "done";
  }

  return "archived";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
