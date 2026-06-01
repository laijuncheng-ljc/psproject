export type ColumnId = "todo" | "doing" | "done";

export interface Card {
  id: string;
  title: string;
  body: string;
  columnId: ColumnId;
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
}
