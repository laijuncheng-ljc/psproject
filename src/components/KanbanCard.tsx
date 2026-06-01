import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import type { Card } from "../types/board";
import {
  getCategoryTone,
  parseCardMetadata,
  stripCardMetadataComments,
} from "../utils/cardMetadata";
import { parseTimeManagementSection } from "../utils/timeManagement";

interface KanbanCardProps {
  card: Card;
  onSelect: (cardId: string) => void;
}

export function KanbanCard({ card, onSelect }: KanbanCardProps) {
  const timeManagement = parseTimeManagementSection(card.body);
  const metadata = parseCardMetadata(timeManagement.body);
  const title = card.title.trim();
  const categoryTone = getCategoryTone(metadata.category);
  const preview = stripCardMetadataComments(timeManagement.body).trim();
  const completedCount = timeManagement.items.filter((item) => item.completed).length;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: "card",
      cardId: card.id,
      columnId: card.columnId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`kanban-card category-${categoryTone}${
        isDragging ? " is-dragging" : ""
      }`}
      style={style}
      onClick={() => onSelect(card.id)}
      {...attributes}
      {...listeners}
    >
      <span className={`card-title${title ? "" : " card-title-empty"}`}>
        {title || "无标题"}
      </span>
      {preview ? (
        <span className="card-preview">{preview}</span>
      ) : (
        <span className="card-preview card-preview-empty">无正文</span>
      )}
      {metadata.category || timeManagement.items.length > 0 ? (
        <span className="card-meta-row">
          {metadata.category ? (
            <span className="category-chip">{metadata.category}</span>
          ) : null}
          {timeManagement.items.length > 0 ? (
            <span className="subitem-progress">
              {completedCount}/{timeManagement.items.length} 子项目
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
