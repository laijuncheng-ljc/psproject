import type { Board, Card, ColumnId } from "../types/board";

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
  };
}

export function deleteCardFromBoard(board: Board, cardId: string): Board {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => card.id !== cardId),
    })),
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
      nextCards.splice(clampedIndex, 0, { ...movingCard, columnId: targetColumnId });

      return { ...column, cards: nextCards };
    }),
  };
}
