import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { Column } from "../types/board";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  column: Column;
  onCardSelect: (cardId: string) => void;
}

export function KanbanColumn({
  column,
  onCardSelect,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${column.id}`,
    data: {
      type: "column",
      columnId: column.id,
    },
  });

  return (
    <section className={`kanban-column${isOver ? " is-over" : ""}`}>
      <div className="column-header">
        <h2>{column.title}</h2>
        <span>{column.cards.length}</span>
      </div>
      <SortableContext
        items={column.cards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="card-list">
          {column.cards.length > 0 ? (
            column.cards.map((card) => (
              <KanbanCard key={card.id} card={card} onSelect={onCardSelect} />
            ))
          ) : (
            <div className="column-empty">暂无卡片</div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
