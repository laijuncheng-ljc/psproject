import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column, ColumnId } from "../types/board";
import {
  CARD_CATEGORY_GROUPS,
  getCategoryLabel,
  getCategoryTone,
  parseCardMetadata,
  type CardCategoryTone,
} from "../utils/cardMetadata";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  column: Column;
  onCardSelect: (cardId: string) => void;
}

export function KanbanColumn({ column, onCardSelect }: KanbanColumnProps) {
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
          {getCardGroups(column.cards).map((group) => (
            <CategoryCardGroup
              key={group.value || "uncategorized"}
              columnId={column.id}
              group={group}
              onCardSelect={onCardSelect}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

interface CardGroup {
  value: string;
  label: string;
  tone: CardCategoryTone;
  cards: Card[];
}

interface CategoryCardGroupProps {
  columnId: ColumnId;
  group: CardGroup;
  onCardSelect: (cardId: string) => void;
}

function CategoryCardGroup({
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
        {group.cards.length > 0 ? (
          group.cards.map((card) => (
            <KanbanCard key={card.id} card={card} onSelect={onCardSelect} />
          ))
        ) : (
          <div className="category-empty">拖到这里</div>
        )}
      </div>
    </section>
  );
}

function getCardGroups(cards: Card[]): CardGroup[] {
  const groupedCards = new Map<string, Card[]>();

  for (const card of cards) {
    const category = parseCardMetadata(card.body).category;
    groupedCards.set(category, [...(groupedCards.get(category) ?? []), card]);
  }

  const requiredGroups: CardGroup[] = CARD_CATEGORY_GROUPS.map((group) => ({
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
    uncategorizedCards.length > 0 || cards.length === 0
      ? [
          {
            value: "",
            label: "未分类",
            tone: "none" as const,
            cards: uncategorizedCards,
          },
        ]
      : [];

  return [...requiredGroups, ...customGroups, ...uncategorizedGroup];
}
