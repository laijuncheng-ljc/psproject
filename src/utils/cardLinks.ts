import { getColumnTitle } from "../constants/columns";
import type { Board, Card } from "../types/board";
import { parseCardMetadata, stripCardMetadataComments } from "./cardMetadata";
import { parseTimeManagementSection } from "./timeManagement";

const WIKI_CARD_LINK_PATTERN = /\[\[card:([A-Za-z0-9_-]+)\]\]/g;
const MARKDOWN_CARD_LINK_PATTERN = /\[[^\]]*?\]\(card:([A-Za-z0-9_-]+)\)/g;
const CARD_LINK_STRIP_PATTERN =
  /\[\[card:[A-Za-z0-9_-]+\]\]|\[[^\]]*?\]\(card:[A-Za-z0-9_-]+\)/g;

export interface LinkedCardReference {
  id: string;
  card: Card | null;
  statusLabel: string;
  category: string;
  detailPath: string;
  completedItems: number;
  totalItems: number;
  preview: string;
  archived: boolean;
}

export function createCardLink(cardId: string): string {
  return `[[card:${cardId}]]`;
}

export function extractCardLinkIds(text: string): string[] {
  const ids = new Set<string>();

  collectIds(text, WIKI_CARD_LINK_PATTERN, ids);
  collectIds(text, MARKDOWN_CARD_LINK_PATTERN, ids);

  return [...ids];
}

export function stripCardLinks(text: string): string {
  return text.replace(CARD_LINK_STRIP_PATTERN, "").trim();
}

export function resolveCardLinks(
  board: Board,
  text: string,
): LinkedCardReference[] {
  return extractCardLinkIds(text).map((id) => {
    const activeCardInfo = findActiveCard(board, id);
    const archivedCard = board.archivedCards.find((card) => card.id === id) ?? null;
    const card = activeCardInfo?.card ?? archivedCard;
    const statusLabel = activeCardInfo
      ? getColumnTitle(activeCardInfo.card.columnId)
      : archivedCard
        ? "归档"
        : "未找到";

    if (!card) {
      return {
        id,
        card: null,
        statusLabel,
        category: "",
        detailPath: "",
        completedItems: 0,
        totalItems: 0,
        preview: "",
        archived: false,
      };
    }

    const parsedTime = parseTimeManagementSection(card.body);
    const metadata = parseCardMetadata(parsedTime.body);
    const cleanPreview = stripCardLinks(
      stripCardMetadataComments(parsedTime.body),
    )
      .replace(/\s+/g, " ")
      .trim();

    return {
      id,
      card,
      statusLabel,
      category: metadata.category,
      detailPath: metadata.detailPath,
      completedItems: parsedTime.items.filter((item) => item.completed).length,
      totalItems: parsedTime.items.length,
      preview: cleanPreview,
      archived: activeCardInfo ? false : Boolean(archivedCard),
    };
  });
}

export function serializeLinkedCardsForSummary(
  board: Board,
  text: string,
): string[] {
  const references = resolveCardLinks(board, text);

  if (references.length === 0) {
    return ["  - 暂无"];
  }

  return references.map((reference) => {
    if (!reference.card) {
      return `  - ${reference.id}: 未找到`;
    }

    const completion =
      reference.totalItems > 0
        ? `，子项目 ${reference.completedItems}/${reference.totalItems}`
        : "";
    const detail = reference.detailPath ? `，专项文档 ${reference.detailPath}` : "";

    return `  - ${reference.card.title || "无标题"}（${reference.id}，${reference.statusLabel}${completion}${detail}）`;
  });
}

function collectIds(
  text: string,
  pattern: RegExp,
  ids: Set<string>,
): void {
  pattern.lastIndex = 0;

  let match = pattern.exec(text);

  while (match) {
    ids.add(match[1]);
    match = pattern.exec(text);
  }
}

function findActiveCard(
  board: Board,
  cardId: string,
): { card: Card } | null {
  for (const column of board.columns) {
    const card = column.cards.find((candidate) => candidate.id === cardId);

    if (card) {
      return { card };
    }
  }

  return null;
}
