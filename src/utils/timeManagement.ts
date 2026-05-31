export interface TimeManagementItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
}

export interface ParsedTimeManagement {
  body: string;
  items: TimeManagementItem[];
}

const SECTION_TITLE = "时间管理";
const SECTION_HEADING = `#### ${SECTION_TITLE}`;
const TASK_PATTERN =
  /^(\s*)[-*]\s+\[([ xX])\]\s+(.*?)(?:\s+<!--\s*completed_at:\s*(.*?)\s*-->)?\s*$/;
const FENCE_PATTERN = /^ {0,3}(```+|~~~+)/;

export function parseTimeManagementSection(body: string): ParsedTimeManagement {
  const lines = normalizeLineEndings(body).split("\n");
  const sectionStart = findTimeManagementSectionStart(lines);

  if (sectionStart === -1) {
    return {
      body: trimBlankEdges(lines).join("\n"),
      items: [],
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
  };
}

export function serializeTimeManagementSection(
  body: string,
  items: TimeManagementItem[],
): string {
  const cleanBody = trimBlankEdges(normalizeLineEndings(body).split("\n")).join("\n");
  const visibleItems = items.filter((item) => item.title.trim() !== "");

  if (visibleItems.length === 0) {
    return cleanBody;
  }

  const taskLines = visibleItems.map((item) => {
    const checkbox = item.completed ? "x" : " ";
    const timestamp =
      item.completed && item.completedAt
        ? ` <!-- completed_at: ${item.completedAt} -->`
        : "";

    return `- [${checkbox}] ${item.title.trim()}${timestamp}`;
  });

  const sectionBlock = `${SECTION_HEADING}\n\n${taskLines.join("\n")}`;

  return cleanBody ? `${cleanBody}\n\n${sectionBlock}` : sectionBlock;
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

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
