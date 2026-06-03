import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  loadCardDetailFile,
  saveCardDetailFile,
} from "../storage/fixedMarkdownFile";
import type { Board, Card } from "../types/board";
import { createCardLink } from "../utils/cardLinks";
import {
  CARD_CATEGORY_OPTIONS,
  parseCardMetadata,
  serializeCardMetadata,
  stripCardMetadataComments,
} from "../utils/cardMetadata";
import {
  createTimeManagementItem,
  formatLocalTimestamp,
  parseTimeManagementSection,
  serializeTimeManagementSection,
  type StageHistoryEntry,
  type TimeManagementItem,
} from "../utils/timeManagement";
import { LinkedCardModules } from "./LinkedCardModules";

interface CardEditorProps {
  card: Card | null;
  board: Board | null;
  isArchived: boolean;
  onSave: (cardId: string, updates: Pick<Card, "title" | "body">) => void;
  onDelete: (cardId: string) => void;
  onArchive: (cardId: string, updates: Pick<Card, "title" | "body">) => void;
  onRestore: (cardId: string, updates: Pick<Card, "title" | "body">) => void;
  onOpenCard: (cardId: string) => void;
  onClose: () => void;
}

export function CardEditor({
  card,
  board,
  isArchived,
  onSave,
  onDelete,
  onArchive,
  onRestore,
  onOpenCard,
  onClose,
}: CardEditorProps) {
  if (!card || !board) {
    return null;
  }

  return (
    <CardEditorForm
      key={card.id}
      card={card}
      board={board}
      isArchived={isArchived}
      onSave={onSave}
      onDelete={onDelete}
      onArchive={onArchive}
      onRestore={onRestore}
      onOpenCard={onOpenCard}
      onClose={onClose}
    />
  );
}

interface CardEditorFormProps extends Omit<CardEditorProps, "card" | "board"> {
  card: Card;
  board: Board;
}

function CardEditorForm({
  card,
  board,
  isArchived,
  onSave,
  onDelete,
  onArchive,
  onRestore,
  onOpenCard,
  onClose,
}: CardEditorFormProps) {
  const parsedTimeManagement = parseTimeManagementSection(card.body);
  const cardMetadata = parseCardMetadata(parsedTimeManagement.body);
  const [title, setTitle] = useState(card.title);
  const [category, setCategory] = useState(cardMetadata.category);
  const [detailPath, setDetailPath] = useState(cardMetadata.detailPath);
  const [detailContent, setDetailContent] = useState("");
  const [savedDetailContent, setSavedDetailContent] = useState("");
  const [detailStatus, setDetailStatus] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailSaving, setIsDetailSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [body, setBody] = useState(
    stripCardMetadataComments(parsedTimeManagement.body),
  );
  const [items, setItems] = useState(parsedTimeManagement.items);
  const [newItemTitle, setNewItemTitle] = useState("");
  const completedCount = items.filter((item) => item.completed).length;
  const categoryOptions = CARD_CATEGORY_OPTIONS.some(
    (option) => option.value === category,
  )
    ? CARD_CATEGORY_OPTIONS
    : [...CARD_CATEGORY_OPTIONS, { value: category, label: category }];

  useEffect(() => {
    const cleanDetailPath = detailPath.trim();

    if (!cleanDetailPath) {
      return;
    }

    let isCurrent = true;

    async function loadDetailDocument() {
      try {
        const file = await loadCardDetailFile(cleanDetailPath);

        if (!isCurrent) {
          return;
        }

        setDetailContent(file.content);
        setSavedDetailContent(file.content);
        setDetailStatus(file.exists ? "已加载专项文档" : "专项文档待创建");
        setDetailError(null);
      } catch (caughtError) {
        if (!isCurrent) {
          return;
        }

        setDetailError(toErrorMessage(caughtError, "读取专项文档失败。"));
      }
    }

    void loadDetailDocument();

    return () => {
      isCurrent = false;
    };
  }, [detailPath]);

  function buildCardUpdates(
    overrides: { detailPath?: string } = {},
  ): Pick<Card, "title" | "body"> {
    const bodyWithMetadata = serializeCardMetadata(
      {
        ...cardMetadata,
        category,
        detailPath: overrides.detailPath ?? detailPath,
      },
      body,
    );

    return {
      title: title.trim(),
      body: serializeTimeManagementSection(
        bodyWithMetadata,
        items,
        parsedTimeManagement.history,
      ),
    };
  }

  async function commitAndClose() {
    if (!(await saveDetailIfNeeded())) {
      return;
    }

    onSave(card.id, buildCardUpdates());
    onClose();
  }

  function handleDelete() {
    if (window.confirm("删除这张卡片？")) {
      onDelete(card.id);
    }
  }

  async function handleArchive() {
    if (!(await saveDetailIfNeeded())) {
      return;
    }

    onArchive(card.id, buildCardUpdates());
    onClose();
  }

  async function handleRestore() {
    if (!(await saveDetailIfNeeded())) {
      return;
    }

    onRestore(card.id, buildCardUpdates());
    onClose();
  }

  async function handleCreateDetailDocument() {
    const nextDetailPath = createDetailPath(card);
    const nextDetailContent = createDefaultDetailContent(title || card.title);

    setDetailPath(nextDetailPath);
    setDetailContent(nextDetailContent);
    setSavedDetailContent("");
    setDetailStatus("正在保存专项文档");
    setDetailError(null);

    try {
      setIsDetailSaving(true);
      await saveCardDetailFile(nextDetailPath, nextDetailContent);
      setSavedDetailContent(nextDetailContent);
      setDetailStatus("已保存专项文档");
      onSave(card.id, buildCardUpdates({ detailPath: nextDetailPath }));
    } catch (caughtError) {
      setDetailError(toErrorMessage(caughtError, "创建专项文档失败。"));
    } finally {
      setIsDetailSaving(false);
    }
  }

  async function handleSaveDetailDocument() {
    await saveDetailIfNeeded(true);
  }

  async function handleCopyCardLink() {
    const link = createCardLink(card.id);

    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus("已复制");
    } catch {
      setCopyStatus(link);
    }
  }

  async function handleOpenLinkedCard(cardId: string) {
    if (!(await saveDetailIfNeeded())) {
      return;
    }

    onSave(card.id, buildCardUpdates());
    onOpenCard(cardId);
  }

  async function saveDetailIfNeeded(force = false): Promise<boolean> {
    const cleanDetailPath = detailPath.trim();

    if (!cleanDetailPath) {
      return true;
    }

    if (!force && detailContent === savedDetailContent) {
      return true;
    }

    setDetailError(null);
    setDetailStatus("正在保存专项文档");

    try {
      setIsDetailSaving(true);
      await saveCardDetailFile(cleanDetailPath, detailContent);
      setSavedDetailContent(detailContent);
      setDetailStatus("已保存专项文档");
      return true;
    } catch (caughtError) {
      setDetailStatus("专项文档保存失败");
      setDetailError(toErrorMessage(caughtError, "保存专项文档失败。"));
      return false;
    } finally {
      setIsDetailSaving(false);
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
        <div className="editor-header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => void handleCopyCardLink()}
          >
            复制链接
          </button>
          <button type="button" className="icon-button" onClick={commitAndClose}>
            关闭
          </button>
        </div>
      </div>
      {copyStatus ? <p className="copy-link-status">{copyStatus}</p> : null}
      <label>
        <span>标题</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        <span>分类</span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categoryOptions.map((option) => (
            <option key={option.value || "none"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="editor-body-field">
        <span>正文</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <LinkedCardModules
        board={board}
        text={body}
        onCardSelect={(cardId) => void handleOpenLinkedCard(cardId)}
      />
      <section className="detail-document-panel">
        <div className="detail-document-header">
          <h3>专项文档</h3>
          {detailPath.trim() ? <span>{detailPath}</span> : null}
        </div>
        {detailPath.trim() ? (
          <>
            <textarea
              value={detailContent}
              onChange={(event) => setDetailContent(event.target.value)}
              aria-label="专项文档正文"
            />
            <div className="detail-document-actions">
              {detailStatus ? <span>{detailStatus}</span> : null}
              <button
                type="button"
                onClick={() => void handleSaveDetailDocument()}
                disabled={isDetailSaving}
              >
                {isDetailSaving ? "保存中" : "保存专项文档"}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="detail-document-create"
            onClick={() => void handleCreateDetailDocument()}
            disabled={isDetailSaving}
          >
            创建专项文档
          </button>
        )}
        {detailError ? <p className="detail-document-error">{detailError}</p> : null}
      </section>
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
        {isArchived ? (
          <button type="button" onClick={handleRestore}>
            恢复
          </button>
        ) : (
          <button type="button" onClick={handleArchive}>
            归档
          </button>
        )}
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

function createDetailPath(card: Card): string {
  const titleSlug = slugify(card.title);

  return `project-data/details/${titleSlug || card.id}.md`;
}

function createDefaultDetailContent(title: string): string {
  const cleanTitle = title.trim() || "专项文档";

  return `# ${cleanTitle}

## 目标


## 数据范围


## 字段与口径

| 字段 | 含义 | 来源 | 口径 | 负责人 | 状态 |
| --- | --- | --- | --- | --- | --- |

## 数据来源


## 交付物


## 确认记录

- ${formatLocalTimestamp()} 创建专项文档
`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
