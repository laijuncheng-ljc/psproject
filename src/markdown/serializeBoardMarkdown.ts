import { DEFAULT_BOARD_TITLE, DEFAULT_COLUMNS } from "../constants/columns";
import type { Board, Card } from "../types/board";
import { generateCardId } from "../utils/id";

export function serializeBoardMarkdown(board: Board): string {
  const title = sanitizeHeading(board.title, DEFAULT_BOARD_TITLE);
  const sections = [`# ${title}`];

  for (const columnConfig of DEFAULT_COLUMNS) {
    const column = board.columns.find((candidate) => candidate.id === columnConfig.id);
    const cardBlocks = (column?.cards ?? []).map((card) => serializeCard(card));
    const columnBody =
      cardBlocks.length > 0
        ? `## ${columnConfig.title}\n\n${cardBlocks.join("\n\n")}`
        : `## ${columnConfig.title}`;

    sections.push(columnBody);
  }

  return `${sections.join("\n\n")}\n`;
}

function serializeCard(card: Card): string {
  const title = sanitizeHeading(card.title, "未命名卡片");
  const id = card.id.trim() || generateCardId();
  const body = trimTrailingBlankLines(card.body);
  const header = `### ${title}\n<!-- id: ${id} -->`;

  return body ? `${header}\n\n${body}` : header;
}

function sanitizeHeading(value: string, fallback: string): string {
  return value.replace(/\r?\n/g, " ").trim() || fallback;
}

function trimTrailingBlankLines(value: string): string {
  return value.replace(/\s+$/g, "");
}
