import {
  DEFAULT_BOARD_TITLE,
  DEFAULT_COLUMNS,
  createDefaultColumns,
} from "../constants/columns";
import type { ArchivedCard, Board, Card, ColumnId } from "../types/board";
import { generateCardId } from "../utils/id";

const COLUMN_TITLE_TO_ID: Record<string, ColumnId> = {
  todo: "todo",
  待办: "todo",
  doing: "doing",
  "进行中": "doing",
  done: "done",
  "已完成": "done",
};

const ID_COMMENT_PATTERN = /^<!--\s*id:\s*(.+?)\s*-->$/;
const COLUMN_COMMENT_PATTERN = /^<!--\s*column:\s*(.+?)\s*-->$/;
const ARCHIVED_AT_COMMENT_PATTERN = /^<!--\s*archived_at:\s*(.+?)\s*-->$/;
const FENCE_PATTERN = /^ {0,3}(```+|~~~+)/;
const NOTES_SECTION_TITLES = new Set([
  "notes",
  "project notes",
  "项目备注",
  "整体备注",
  "总体备注",
]);
const SUMMARY_SECTION_TITLES = new Set([
  "current task status",
  "task status",
  "当前任务状态",
  "任务状态",
]);
const ARCHIVE_SECTION_TITLES = new Set(["archive", "archived", "归档", "已归档"]);

export function parseBoardMarkdown(markdown: string): Board {
  const normalizedMarkdown = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (normalizedMarkdown.trim() === "") {
    return {
      title: DEFAULT_BOARD_TITLE,
      notes: "",
      columns: createDefaultColumns(),
      archivedCards: [],
    };
  }

  const columns = createDefaultColumns();
  const archivedCards: ArchivedCard[] = [];
  const lines = normalizedMarkdown.split("\n");
  let boardTitle = DEFAULT_BOARD_TITLE;
  const boardNotesLines: string[] = [];
  let currentBoardSection: "notes" | "archive" | null = null;
  let currentColumnId: ColumnId | null = null;
  let currentCardTitle: string | null = null;
  let currentCardBodyLines: string[] = [];
  let insideFence = false;

  const flushCurrentCard = () => {
    if (currentCardTitle === null) {
      currentCardTitle = null;
      currentCardBodyLines = [];
      return;
    }

    if (currentBoardSection === "archive") {
      archivedCards.push(createArchivedCard(currentCardTitle, currentCardBodyLines));
      currentCardTitle = null;
      currentCardBodyLines = [];
      return;
    }

    if (currentColumnId === null) {
      currentCardTitle = null;
      currentCardBodyLines = [];
      return;
    }

    const card = createCard(currentColumnId, currentCardTitle, currentCardBodyLines);
    const column = columns.find((candidate) => candidate.id === currentColumnId);

    if (column) {
      column.cards.push(card);
    }

    currentCardTitle = null;
    currentCardBodyLines = [];
  };

  for (const line of lines) {
    if (!insideFence) {
      const boardTitleMatch = /^#\s+(.+?)\s*$/.exec(line);

      if (boardTitleMatch && currentBoardSection !== "notes") {
        flushCurrentCard();
        boardTitle = boardTitleMatch[1].trim() || DEFAULT_BOARD_TITLE;
        currentBoardSection = null;
        currentColumnId = null;
        continue;
      }

      const columnTitleMatch = /^##\s+(.+?)\s*$/.exec(line);

      if (columnTitleMatch) {
        flushCurrentCard();
        const normalizedColumnTitle = columnTitleMatch[1].trim().toLowerCase();
        const columnId = COLUMN_TITLE_TO_ID[normalizedColumnTitle] ?? null;

        if (isNotesSectionTitle(normalizedColumnTitle)) {
          currentBoardSection = "notes";
          currentColumnId = null;
          continue;
        }

        if (isArchiveSectionTitle(normalizedColumnTitle)) {
          currentBoardSection = "archive";
          currentColumnId = null;
          continue;
        }

        if (
          currentBoardSection === "notes" &&
          columnId === null &&
          !isSummarySectionTitle(normalizedColumnTitle)
        ) {
          boardNotesLines.push(line);
          continue;
        }

        currentBoardSection = null;
        currentColumnId = columnId;
        continue;
      }

      const cardTitleMatch = /^###\s+(.+?)\s*$/.exec(line);

      if (cardTitleMatch && (currentColumnId || currentBoardSection === "archive")) {
        flushCurrentCard();
        currentCardTitle = cardTitleMatch[1].trim() || "无标题";
        currentCardBodyLines = [];
        continue;
      }
    }

    if (currentBoardSection === "notes") {
      boardNotesLines.push(line);
    } else if (currentCardTitle !== null) {
      currentCardBodyLines.push(line);
    }

    if (isFenceLine(line)) {
      insideFence = !insideFence;
    }
  }

  flushCurrentCard();

  return {
    title: boardTitle,
    notes: trimBlankEdges(boardNotesLines).join("\n"),
    columns: DEFAULT_COLUMNS.map((column) => ({
      ...column,
      cards: columns.find((candidate) => candidate.id === column.id)?.cards ?? [],
    })),
    archivedCards,
  };
}

function isNotesSectionTitle(title: string): boolean {
  return NOTES_SECTION_TITLES.has(title);
}

function isSummarySectionTitle(title: string): boolean {
  return SUMMARY_SECTION_TITLES.has(title);
}

function isArchiveSectionTitle(title: string): boolean {
  return ARCHIVE_SECTION_TITLES.has(title);
}

function createCard(
  columnId: ColumnId,
  title: string,
  bodyLines: string[],
): Card {
  const { id, body } = extractCardMetadataAndBody(bodyLines);

  return {
    id: id ?? generateCardId(),
    title,
    body,
    columnId,
  };
}

function createArchivedCard(title: string, bodyLines: string[]): ArchivedCard {
  const { id, columnId, archivedAt, body } = extractCardMetadataAndBody(bodyLines);
  const originalColumnId = columnId ?? "todo";

  return {
    id: id ?? generateCardId(),
    title,
    body,
    columnId: originalColumnId,
    originalColumnId,
    archivedAt,
  };
}

function extractCardMetadataAndBody(bodyLines: string[]): {
  id: string | null;
  columnId: ColumnId | null;
  archivedAt: string | null;
  body: string;
} {
  let id: string | null = null;
  let columnId: ColumnId | null = null;
  let archivedAt: string | null = null;
  let insideFence = false;
  const bodyContentLines: string[] = [];

  for (const line of bodyLines) {
    const idMatch = !insideFence ? ID_COMMENT_PATTERN.exec(line.trim()) : null;
    const columnMatch = !insideFence
      ? COLUMN_COMMENT_PATTERN.exec(line.trim())
      : null;
    const archivedAtMatch = !insideFence
      ? ARCHIVED_AT_COMMENT_PATTERN.exec(line.trim())
      : null;

    if (idMatch && id === null) {
      id = idMatch[1].trim();
    } else if (columnMatch && columnId === null) {
      columnId = normalizeColumnId(columnMatch[1].trim());
    } else if (archivedAtMatch && archivedAt === null) {
      archivedAt = archivedAtMatch[1].trim() || null;
    } else {
      bodyContentLines.push(line);
    }

    if (isFenceLine(line)) {
      insideFence = !insideFence;
    }
  }

  return {
    id,
    columnId,
    archivedAt,
    body: trimBlankEdges(bodyContentLines).join("\n"),
  };
}

function normalizeColumnId(value: string): ColumnId | null {
  return COLUMN_TITLE_TO_ID[value.toLowerCase()] ?? null;
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

function isFenceLine(line: string): boolean {
  return FENCE_PATTERN.test(line);
}
