import type { ArchivedCard, Board, Card, ColumnId } from "../types/board";
import { updateCardCategory } from "./cardMetadata";
import { appendStageHistory, formatLocalTimestamp } from "./timeManagement";

export interface CardLocation {
  columnId: ColumnId;
  columnIndex: number;
  cardIndex: number;
}

export function findCardLocation(
  board: Board,
  cardId: string,
): CardLocation | null {
  for (let columnIndex = 0; columnIndex < board.columns.length; columnIndex += 1) {
    const column = board.columns[columnIndex];
    const cardIndex = column.cards.findIndex((card) => card.id === cardId);

    if (cardIndex !== -1) {
      return { columnId: column.id, columnIndex, cardIndex };
    }
  }

  return null;
}

export function getCardById(board: Board, cardId: string): Card | null {
  const location = findCardLocation(board, cardId);

  if (!location) {
    return null;
  }

  return board.columns[location.columnIndex].cards[location.cardIndex];
}

export function getArchivedCardById(
  board: Board,
  cardId: string,
): ArchivedCard | null {
  return board.archivedCards.find((card) => card.id === cardId) ?? null;
}

export function addCardToBoard(board: Board, columnId: ColumnId, card: Card): Board {
  return {
    ...board,
    columns: board.columns.map((column) =>
      column.id === columnId
        ? { ...column, cards: [...column.cards, { ...card, columnId }] }
        : column,
    ),
  };
}

export function updateCardInBoard(
  board: Board,
  cardId: string,
  updates: Pick<Card, "title" | "body">,
): Board {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map((card) =>
        card.id === cardId ? { ...card, ...updates } : card,
      ),
    })),
    archivedCards: board.archivedCards.map((card) =>
      card.id === cardId ? { ...card, ...updates } : card,
    ),
  };
}

export function updateCardCategoryInBoard(
  board: Board,
  cardId: string,
  category: string,
): Board {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map((card) =>
        card.id === cardId
          ? { ...card, body: updateCardCategory(card.body, category) }
          : card,
      ),
    })),
    archivedCards: board.archivedCards.map((card) =>
      card.id === cardId
        ? { ...card, body: updateCardCategory(card.body, category) }
        : card,
    ),
  };
}

export function deleteCardFromBoard(board: Board, cardId: string): Board {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => card.id !== cardId),
    })),
    archivedCards: board.archivedCards.filter((card) => card.id !== cardId),
  };
}

export function archiveCardInBoard(
  board: Board,
  cardId: string,
  archivedAt = formatLocalTimestamp(),
): Board {
  const source = findCardLocation(board, cardId);

  if (!source) {
    return board;
  }

  const card = board.columns[source.columnIndex].cards[source.cardIndex];
  const archivedCard: ArchivedCard = {
    ...card,
    body: appendStageHistory(card.body, "archived", archivedAt),
    originalColumnId: card.columnId,
    archivedAt,
  };

  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((candidate) => candidate.id !== cardId),
    })),
    archivedCards: [
      archivedCard,
      ...board.archivedCards.filter((candidate) => candidate.id !== cardId),
    ],
  };
}

export function restoreCardInBoard(board: Board, cardId: string): Board {
  const archivedCard = getArchivedCardById(board, cardId);

  if (!archivedCard) {
    return board;
  }

  const targetColumnId = archivedCard.originalColumnId;
  const restoredCard: Card = {
    id: archivedCard.id,
    title: archivedCard.title,
    body: appendStageHistory(archivedCard.body, targetColumnId),
    columnId: targetColumnId,
  };

  return {
    ...board,
    columns: board.columns.map((column) =>
      column.id === targetColumnId
        ? { ...column, cards: [...column.cards, restoredCard] }
        : column,
    ),
    archivedCards: board.archivedCards.filter((card) => card.id !== cardId),
  };
}

export function moveCard(
  board: Board,
  cardId: string,
  targetColumnId: ColumnId,
  targetIndex: number,
): Board {
  const source = findCardLocation(board, cardId);

  if (!source) {
    return board;
  }

  const movingCard = board.columns[source.columnIndex].cards[source.cardIndex];
  const movedAcrossColumns = source.columnId !== targetColumnId;
  const nextMovingCard = movedAcrossColumns
    ? { ...movingCard, body: appendStageHistory(movingCard.body, targetColumnId) }
    : movingCard;

  const columnsWithoutCard = board.columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => card.id !== cardId),
  }));

  return {
    ...board,
    columns: columnsWithoutCard.map((column) => {
      if (column.id !== targetColumnId) {
        return column;
      }

      const nextCards = [...column.cards];
      const clampedIndex = Math.max(0, Math.min(targetIndex, nextCards.length));
      nextCards.splice(clampedIndex, 0, {
        ...nextMovingCard,
        columnId: targetColumnId,
      });

      return { ...column, cards: nextCards };
    }),
  };
}
