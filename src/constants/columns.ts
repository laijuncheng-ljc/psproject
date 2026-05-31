import type { Column, ColumnId } from "../types/board";

export const DEFAULT_COLUMNS = [
  { id: "todo", title: "Todo" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
] as const satisfies ReadonlyArray<{ id: ColumnId; title: string }>;

export const DEFAULT_BOARD_TITLE = "Personal Board";

export function createDefaultColumns(): Column[] {
  return DEFAULT_COLUMNS.map((column) => ({ ...column, cards: [] }));
}

export function getColumnTitle(columnId: ColumnId): string {
  return (
    DEFAULT_COLUMNS.find((column) => column.id === columnId)?.title ?? columnId
  );
}
