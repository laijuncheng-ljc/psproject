export type ColumnId = "todo" | "doing" | "done";

export interface Card {
  id: string;
  title: string;
  body: string;
  columnId: ColumnId;
}

export interface ArchivedCard extends Card {
  archivedAt: string | null;
  originalColumnId: ColumnId;
}

export interface Column {
  id: ColumnId;
  title: string;
  cards: Card[];
}

export interface Board {
  title: string;
  notes: string;
  columns: Column[];
  archivedCards: ArchivedCard[];
}
