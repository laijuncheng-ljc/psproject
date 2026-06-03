import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import type { Board, ColumnId } from "../types/board";
import {
  findCardLocation,
  getCardById,
  moveCard,
  updateCardCategoryInBoard,
} from "../utils/board";
import { parseCardMetadata, stripCardMetadataComments } from "../utils/cardMetadata";
import { ArchivePanel } from "./ArchivePanel";
import { KanbanColumn } from "./KanbanColumn";

interface BoardViewProps {
  board: Board;
  onBoardChange: (board: Board) => void;
  onCardSelect: (cardId: string) => void;
}

type DropData =
  | { type: "card"; cardId: string; columnId: ColumnId }
  | { type: "column"; columnId: ColumnId }
  | { type: "category"; columnId: ColumnId; category: string };

export function BoardView({
  board,
  onBoardChange,
  onCardSelect,
}: BoardViewProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeCard = useMemo(
    () => (activeCardId ? getCardById(board, activeCardId) : null),
    [activeCardId, board],
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const activeLocation = findCardLocation(board, activeId);
    const over = event.over;
    setActiveCardId(null);

    if (!activeLocation || !over) {
      return;
    }

    const overData = over.data.current as DropData | undefined;
    let targetColumnId: ColumnId | null = null;
    let targetIndex = 0;
    let targetCategory: string | null = null;
    const activeCard = getCardById(board, activeId);
    const activeCategory = activeCard ? parseCardMetadata(activeCard.body).category : "";

    if (overData?.type === "card") {
      const overLocation = findCardLocation(board, String(over.id));
      const overCard = getCardById(board, String(over.id));

      if (!overLocation || !overCard) {
        return;
      }

      targetColumnId = overLocation.columnId;
      targetIndex = overLocation.cardIndex;
      targetCategory = parseCardMetadata(overCard.body).category;
    }

    if (overData?.type === "column") {
      targetColumnId = overData.columnId;
      targetIndex =
        board.columns.find((column) => column.id === targetColumnId)?.cards.length ?? 0;
    }

    if (overData?.type === "category") {
      targetColumnId = overData.columnId;
      targetCategory = overData.category;
      targetIndex =
        board.columns.find((column) => column.id === targetColumnId)?.cards.length ?? 0;
    }

    if (!targetColumnId) {
      return;
    }

    const categoryChanged =
      targetCategory !== null && targetCategory !== activeCategory;

    const sourceColumnLength =
      board.columns.find((column) => column.id === activeLocation.columnId)?.cards
        .length ?? 0;
    const movingToSameSpot =
      activeLocation.columnId === targetColumnId &&
      (activeLocation.cardIndex === targetIndex ||
        (activeLocation.cardIndex === sourceColumnLength - 1 &&
          targetIndex === sourceColumnLength));

    if (movingToSameSpot && !categoryChanged) {
      return;
    }

    const movedBoard = moveCard(board, activeId, targetColumnId, targetIndex);

    onBoardChange(
      targetCategory === null
        ? movedBoard
        : updateCardCategoryInBoard(movedBoard, activeId, targetCategory),
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveCardId(null)}
      onDragEnd={handleDragEnd}
    >
      <main className="board-shell" aria-label={board.title}>
        <div className="board-columns">
          {board.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              onCardSelect={onCardSelect}
            />
          ))}
        </div>
        <ArchivePanel
          archivedCards={board.archivedCards}
          onCardSelect={onCardSelect}
        />
      </main>
      <DragOverlay>
        {activeCard ? (
          <div className="kanban-card category-none drag-overlay-card">
            <span className="card-title">{activeCard.title}</span>
            {activeCard.body.trim() ? (
              <span className="card-preview">
                {stripCardMetadataComments(activeCard.body).trim()}
              </span>
            ) : null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
