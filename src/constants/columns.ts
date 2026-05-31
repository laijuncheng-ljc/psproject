import type { Column, ColumnId } from "../types/board";

export const DEFAULT_COLUMNS = [
  { id: "todo", title: "待办" },
  { id: "doing", title: "进行中" },
  { id: "done", title: "已完成" },
] as const satisfies ReadonlyArray<{ id: ColumnId; title: string }>;

export const DEFAULT_BOARD_TITLE = "个人看板";

export function createDefaultColumns(): Column[] {
  return DEFAULT_COLUMNS.map((column) => ({ ...column, cards: [] }));
}

export function getColumnTitle(columnId: ColumnId): string {
  return (
    DEFAULT_COLUMNS.find((column) => column.id === columnId)?.title ?? columnId
  );
}
