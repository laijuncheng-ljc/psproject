import { useState } from "react";
import type { FormEvent } from "react";
import type { Card } from "../types/board";
import {
  createTimeManagementItem,
  formatLocalTimestamp,
  parseTimeManagementSection,
  serializeTimeManagementSection,
  type StageHistoryEntry,
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
      title: title.trim() || "未命名卡片",
      body: serializeTimeManagementSection(body, items, parsedTimeManagement.history),
    });
    onClose();
  }

  function handleDelete() {
    if (window.confirm("删除这张卡片？")) {
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
    <aside className="card-editor" aria-label="卡片编辑器">
      <div className="editor-header">
        <h2>编辑卡片</h2>
        <button type="button" className="icon-button" onClick={commitAndClose}>
          关闭
        </button>
      </div>
      <label>
        <span>标题</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="editor-body-field">
        <span>正文</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <section className="time-management-panel">
        <div className="time-management-header">
          <h3>时间管理</h3>
          <span>
            {completedCount}/{items.length}
          </span>
        </div>
        <StageHistoryList entries={parsedTimeManagement.history} />
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
            <p className="time-management-empty">暂无子项目</p>
          )}
        </div>
        <form className="time-management-add" onSubmit={handleAddItem}>
          <input
            value={newItemTitle}
            onChange={(event) => setNewItemTitle(event.target.value)}
            placeholder="添加子项目"
            aria-label="添加子项目"
          />
          <button type="submit">添加</button>
        </form>
      </section>
      <div className="editor-actions">
        <button type="button" className="button-danger" onClick={handleDelete}>
          删除
        </button>
        <button type="button" className="button-primary" onClick={commitAndClose}>
          完成
        </button>
      </div>
    </aside>
  );
}

interface StageHistoryListProps {
  entries: StageHistoryEntry[];
}

function StageHistoryList({ entries }: StageHistoryListProps) {
  return (
    <div className="stage-history">
      <h4>环节记录</h4>
      {entries.length > 0 ? (
        <ol>
          {entries.map((entry) => (
            <li key={entry.id}>
              <span>{entry.timestamp}</span>
              <strong>进入{getStageLabel(entry.stage)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p>暂无环节记录</p>
      )}
    </div>
  );
}

function getStageLabel(stage: StageHistoryEntry["stage"]): string {
  if (stage === "todo") return "待办";
  if (stage === "doing") return "进行中";
  if (stage === "done") return "已完成";
  return "归档";
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
        aria-label={`切换 ${item.title}`}
      />
      <div className="time-management-item-main">
        <input
          value={item.title}
          onChange={(event) => onTitleChange(item.id, event.target.value)}
          aria-label="子项目标题"
        />
        {item.completedAt ? (
          <span className="completion-time">完成于 {item.completedAt}</span>
        ) : null}
      </div>
      <button
        type="button"
        className="time-management-remove"
        onClick={() => onRemove(item.id)}
      >
        移除
      </button>
    </div>
  );
}
