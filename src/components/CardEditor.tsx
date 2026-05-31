import { useState } from "react";
import type { FormEvent } from "react";
import type { Card } from "../types/board";
import {
  createTimeManagementItem,
  formatLocalTimestamp,
  parseTimeManagementSection,
  serializeTimeManagementSection,
  type TimeManagementItem,
} from "../utils/timeManagement";

interface CardEditorProps {
  card: Card | null;
  onSave: (cardId: string, updates: Pick<Card, "title" | "body">) => void;
  onDelete: (cardId: string) => void;
  onClose: () => void;
}

export function CardEditor({ card, onSave, onDelete, onClose }: CardEditorProps) {
  if (!card) {
    return null;
  }

  return (
    <CardEditorForm
      key={card.id}
      card={card}
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
}

interface CardEditorFormProps extends Omit<CardEditorProps, "card"> {
  card: Card;
}

function CardEditorForm({ card, onSave, onDelete, onClose }: CardEditorFormProps) {
  const parsedTimeManagement = parseTimeManagementSection(card.body);
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(parsedTimeManagement.body);
  const [items, setItems] = useState(parsedTimeManagement.items);
  const [newItemTitle, setNewItemTitle] = useState("");
  const completedCount = items.filter((item) => item.completed).length;

  function commitAndClose() {
    onSave(card.id, {
      title: title.trim() || "Untitled card",
      body: serializeTimeManagementSection(body, items),
    });
    onClose();
  }

  function handleDelete() {
    if (window.confirm("Delete this card?")) {
      onDelete(card.id);
    }
  }

  function handleItemToggle(itemId: string, completed: boolean) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              completed,
              completedAt: completed ? formatLocalTimestamp() : null,
            }
          : item,
      ),
    );
  }

  function handleItemTitleChange(itemId: string, nextTitle: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, title: nextTitle } : item,
      ),
    );
  }

  function handleRemoveItem(itemId: string) {
    setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
  }

  function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanTitle = newItemTitle.trim();

    if (!cleanTitle) {
      return;
    }

    setItems((currentItems) => [
      ...currentItems,
      createTimeManagementItem(cleanTitle),
    ]);
    setNewItemTitle("");
  }

  return (
    <aside className="card-editor" aria-label="Card editor">
      <div className="editor-header">
        <h2>Edit card</h2>
        <button type="button" className="icon-button" onClick={commitAndClose}>
          Close
        </button>
      </div>
      <label>
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="editor-body-field">
        <span>Body</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <section className="time-management-panel">
        <div className="time-management-header">
          <h3>Time Management</h3>
          <span>
            {completedCount}/{items.length}
          </span>
        </div>
        <div className="time-management-list">
          {items.length > 0 ? (
            items.map((item) => (
              <TimeManagementRow
                key={item.id}
                item={item}
                onToggle={handleItemToggle}
                onTitleChange={handleItemTitleChange}
                onRemove={handleRemoveItem}
              />
            ))
          ) : (
            <p className="time-management-empty">No subitems</p>
          )}
        </div>
        <form className="time-management-add" onSubmit={handleAddItem}>
          <input
            value={newItemTitle}
            onChange={(event) => setNewItemTitle(event.target.value)}
            placeholder="Add subitem"
            aria-label="Add subitem"
          />
          <button type="submit">Add</button>
        </form>
      </section>
      <div className="editor-actions">
        <button type="button" className="button-danger" onClick={handleDelete}>
          Delete
        </button>
        <button type="button" className="button-primary" onClick={commitAndClose}>
          Done
        </button>
      </div>
    </aside>
  );
}

interface TimeManagementRowProps {
  item: TimeManagementItem;
  onToggle: (itemId: string, completed: boolean) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onRemove: (itemId: string) => void;
}

function TimeManagementRow({
  item,
  onToggle,
  onTitleChange,
  onRemove,
}: TimeManagementRowProps) {
  return (
    <div className="time-management-row">
      <input
        type="checkbox"
        checked={item.completed}
        onChange={(event) => onToggle(item.id, event.target.checked)}
        aria-label={`Toggle ${item.title}`}
      />
      <div className="time-management-item-main">
        <input
          value={item.title}
          onChange={(event) => onTitleChange(item.id, event.target.value)}
          aria-label="Subitem title"
        />
        {item.completedAt ? (
          <span className="completion-time">Completed {item.completedAt}</span>
        ) : null}
      </div>
      <button
        type="button"
        className="time-management-remove"
        onClick={() => onRemove(item.id)}
      >
        Remove
      </button>
    </div>
  );
}
