import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import type { CSSProperties } from "react";
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
  const totalItems = timeManagement.items.length;
  const progressPercent =
    totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
  const priority = normalizePriority(metadata.priority);
  const visibleTags = metadata.tags.slice(0, 2);
  const hiddenTagCount = Math.max(0, metadata.tags.length - visibleTags.length);
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

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const progressStyle = {
    "--progress": `${progressPercent}%`,
  } as CSSProperties;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`kanban-card category-${categoryTone}${
        isDragging ? " is-dragging" : ""
      }`}
      style={dragStyle}
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
      {metadata.category || priority || visibleTags.length > 0 || totalItems > 0 ? (
        <span className="card-meta-row">
          {metadata.category ? (
            <span className="category-chip">{metadata.category}</span>
          ) : null}
          {priority ? (
            <span className={`priority-chip priority-${priority}`}>
              {getPriorityLabel(priority)}
            </span>
          ) : null}
          {visibleTags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
            </span>
          ))}
          {hiddenTagCount > 0 ? (
            <span className="tag-chip">+{hiddenTagCount}</span>
          ) : null}
          {totalItems > 0 ? (
            <span className="subitem-progress" style={progressStyle}>
              {completedCount}/{totalItems}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

function normalizePriority(priority: string | null): "high" | "medium" | "low" | null {
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }

  return null;
}

function getPriorityLabel(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "高";
  if (priority === "medium") return "中";
  return "低";
}
