import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Board, Card, Column, ColumnId } from "../types/board";
import {
  CARD_CATEGORY_GROUPS,
  getCategoryLabel,
  getCategoryTone,
  parseCardMetadata,
  type CardCategoryTone,
} from "../utils/cardMetadata";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  board: Board;
  column: Column;
  onCardSelect: (cardId: string) => void;
}

export function KanbanColumn({ board, column, onCardSelect }: KanbanColumnProps) {
  const groupedCards = getCardGroups(column.cards);
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
      <div className="column-module-summary" aria-hidden="true">
        {groupedCards.summaryGroups.map((group) => (
          <span key={group.value} className={`category-${group.tone}`}>
            {group.label}
            <strong>{group.cards.length}</strong>
          </span>
        ))}
      </div>
      <SortableContext
        items={column.cards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="card-list">
          {groupedCards.visibleGroups.length > 0 ? (
            groupedCards.visibleGroups.map((group) => (
              <CategoryCardGroup
                key={group.value || "uncategorized"}
                board={board}
                columnId={column.id}
                group={group}
                onCardSelect={onCardSelect}
              />
            ))
          ) : (
            <div className="column-empty-state">暂无卡片</div>
          )}
          {groupedCards.emptyDropGroups.length > 0 ? (
            <div className="category-drop-strip">
              {groupedCards.emptyDropGroups.map((group) => (
                <CategoryDropTarget
                  key={group.value}
                  columnId={column.id}
                  group={group}
                />
              ))}
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

interface CardGroupSet {
  summaryGroups: CardGroup[];
  visibleGroups: CardGroup[];
  emptyDropGroups: CardGroup[];
}

interface CardGroup {
  value: string;
  label: string;
  tone: CardCategoryTone;
  cards: Card[];
}

interface CategoryDropTargetProps {
  columnId: ColumnId;
  group: CardGroup;
}

function CategoryDropTarget({ columnId, group }: CategoryDropTargetProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `category:${columnId}:${group.value}`,
    data: {
      type: "category",
      columnId,
      category: group.value,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`category-drop-target category-${group.tone}${
        isOver ? " is-over" : ""
      }`}
    >
      <span>{group.label}</span>
    </div>
  );
}

interface CategoryCardGroupProps {
  board: Board;
  columnId: ColumnId;
  group: CardGroup;
  onCardSelect: (cardId: string) => void;
}

function CategoryCardGroup({
  board,
  columnId,
  group,
  onCardSelect,
}: CategoryCardGroupProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `category:${columnId}:${group.value || "uncategorized"}`,
    data: {
      type: "category",
      columnId,
      category: group.value,
    },
  });

  return (
    <section
      ref={setNodeRef}
      className={`card-category-section category-${group.tone}${
        isOver ? " is-over" : ""
      }`}
    >
      <div className="card-category-header">
        <span>{group.label}</span>
        <strong>{group.cards.length}</strong>
      </div>
      <div className="card-category-list">
        {group.cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            board={board}
            onSelect={onCardSelect}
          />
        ))}
      </div>
    </section>
  );
}

function getCardGroups(cards: Card[]): CardGroupSet {
  const groupedCards = new Map<string, Card[]>();

  for (const card of cards) {
    const category = parseCardMetadata(card.body).category;
    groupedCards.set(category, [...(groupedCards.get(category) ?? []), card]);
  }

  const summaryGroups: CardGroup[] = CARD_CATEGORY_GROUPS.map((group) => ({
    ...group,
    cards: groupedCards.get(group.value) ?? [],
  }));
  const knownCategories = new Set([
    "",
    ...CARD_CATEGORY_GROUPS.map((group) => group.value),
  ]);
  const customGroups = [...groupedCards.entries()]
    .filter(([category]) => !knownCategories.has(category))
    .sort(([firstCategory], [secondCategory]) =>
      firstCategory.localeCompare(secondCategory, "zh-Hans-CN"),
    )
    .map(([category, categoryCards]) => ({
      value: category,
      label: getCategoryLabel(category),
      tone: getCategoryTone(category),
      cards: categoryCards,
    }));
  const uncategorizedCards = groupedCards.get("") ?? [];
  const uncategorizedGroup =
    uncategorizedCards.length > 0
      ? [
          {
            value: "",
            label: "未分类",
            tone: "none" as const,
            cards: uncategorizedCards,
          },
        ]
      : [];

  return {
    summaryGroups,
    visibleGroups: [
      ...summaryGroups.filter((group) => group.cards.length > 0),
      ...customGroups,
      ...uncategorizedGroup,
    ],
    emptyDropGroups: summaryGroups.filter((group) => group.cards.length === 0),
  };
}
