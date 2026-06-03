import { useState } from "react";
import type { ArchivedCard, Board } from "../types/board";
import { StaticKanbanCard } from "./KanbanCard";

interface ArchivePanelProps {
  board: Board;
  archivedCards: ArchivedCard[];
  onCardSelect: (cardId: string) => void;
}

export function ArchivePanel({
  board,
  archivedCards,
  onCardSelect,
}: ArchivePanelProps) {
  const [isOpen, setIsOpen] = useState(archivedCards.length > 0);

  return (
    <details
      className="archive-panel"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        <span>归档</span>
        <strong>{archivedCards.length}</strong>
      </summary>
      {archivedCards.length > 0 ? (
        <div className="archive-card-list">
          {archivedCards.map((card) => (
            <div key={card.id} className="archive-card-shell">
              <div className="archive-card-meta">
                <span>原状态：{getOriginalColumnLabel(card.originalColumnId)}</span>
                <span>{card.archivedAt ? `归档于 ${card.archivedAt}` : "未记录归档时间"}</span>
              </div>
              <StaticKanbanCard
                card={card}
                board={board}
                onSelect={onCardSelect}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="archive-empty">暂无归档卡片</p>
      )}
    </details>
  );
}

function getOriginalColumnLabel(columnId: ArchivedCard["originalColumnId"]): string {
  if (columnId === "todo") return "待办";
  if (columnId === "doing") return "进行中";
  return "已完成";
}
