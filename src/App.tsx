import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardView } from "./components/BoardView";
import { CardEditor } from "./components/CardEditor";
import { EmptyState } from "./components/EmptyState";
import { ErrorBanner } from "./components/ErrorBanner";
import { ProjectNotesEditor } from "./components/ProjectNotesEditor";
import { Toolbar } from "./components/Toolbar";
import { parseBoardMarkdown } from "./markdown/parseBoardMarkdown";
import { serializeBoardMarkdown } from "./markdown/serializeBoardMarkdown";
import {
  createFixedMarkdownBackup,
  loadFixedMarkdownFile,
  saveFixedMarkdownFile,
  type SupportMarkdownDoc,
  type BackupSnapshot,
} from "./storage/fixedMarkdownFile";
import type { Board, Card, ColumnId } from "./types/board";
import {
  addCardToBoard,
  archiveCardInBoard,
  deleteCardFromBoard,
  getArchivedCardById,
  getCardById,
  restoreCardInBoard,
  updateCardInBoard,
} from "./utils/board";
import { generateCardId } from "./utils/id";
import {
  serializeAchievementsMarkdown,
  serializeNotesMarkdown,
  serializeResourcesMarkdown,
} from "./utils/gamification";
import { appendStageHistory } from "./utils/timeManagement";

const DEFAULT_NEW_CARD_COLUMN_ID: ColumnId = "todo";
const AUTO_BACKUP_ENABLED_KEY = "local-md-kanban:auto-backup-enabled";
const AUTO_BACKUP_LAST_RUN_KEY = "local-md-kanban:auto-backup-last-run-at";
const AUTO_BACKUP_INTERVAL_MS = 2 * 60 * 60 * 1000;
const AUTO_BACKUP_CHECK_MS = 60 * 1000;
const AUTO_SAVE_DEBOUNCE_MS = 700;

type BackupReason = "manual" | "auto";
type SaveReason = "manual" | "auto";

function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notesEditorOpen, setNotesEditorOpen] = useState(false);
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [backupEnabled, setBackupEnabled] = useState(() =>
    readStoredBoolean(AUTO_BACKUP_ENABLED_KEY, false),
  );
  const [isBackingUp, setIsBackingUp] = useState(false);
  const boardRevisionRef = useRef(0);

  const selectedCard = useMemo(
    () =>
      board && selectedCardId
        ? getCardById(board, selectedCardId) ??
          getArchivedCardById(board, selectedCardId)
        : null,
    [board, selectedCardId],
  );
  const selectedCardArchived = useMemo(
    () =>
      Boolean(board && selectedCardId && getArchivedCardById(board, selectedCardId)),
    [board, selectedCardId],
  );

  const loadBoard = useCallback(async () => {
    setError(null);
    setStatusMessage(null);
    setIsLoading(true);

    try {
      const file = await loadFixedMarkdownFile();

      setFileName(file.fileName);
      setBoard(parseBoardMarkdown(file.content));
      setBackups(file.backups);
      boardRevisionRef.current = 0;
      setDirty(false);
      setSelectedCardId(null);
      setStatusMessage("已加载");
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "读取固定 Markdown 文件失败。"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBoard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBoard]);

  const markBoardChanged = useCallback((nextBoard: Board) => {
    boardRevisionRef.current += 1;
    setBoard(nextBoard);
    setDirty(true);
    setStatusMessage("等待自动保存");
  }, []);

  const saveBoardSnapshot = useCallback(
    async (boardSnapshot: Board, reason: SaveReason) => {
      const saveRevision = boardRevisionRef.current;

      setError(null);
      setStatusMessage(reason === "auto" ? "正在自动保存" : "正在保存");

      try {
        const result = await saveFixedMarkdownFile(
          serializeBoardMarkdown(boardSnapshot),
          getSupportDocs(boardSnapshot),
        );

        setFileName(result.fileName);

        if (saveRevision === boardRevisionRef.current) {
          setDirty(false);
          setStatusMessage(
            reason === "auto"
              ? `已自动保存 ${formatStatusTime(result.savedAt)}`
              : `已保存 ${formatStatusTime(result.savedAt)}`,
          );
        } else {
          setStatusMessage("等待自动保存");
        }
      } catch (caughtError) {
        setDirty(true);
        setStatusMessage(reason === "auto" ? "自动保存失败" : "保存失败");
        setError(toErrorMessage(caughtError, "保存 Markdown 文件失败。"));
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setError(null);

    if (!board) {
      setError("还没有载入固定 Markdown 文件。");
      return;
    }

    await saveBoardSnapshot(board, "manual");
  }, [board, saveBoardSnapshot]);

  useEffect(() => {
    if (!dirty || !board || isLoading) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveBoardSnapshot(board, "auto");
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [board, dirty, isLoading, saveBoardSnapshot]);

  const handleCreateBackup = useCallback(
    async (reason: BackupReason = "manual") => {
      if (!board || isBackingUp) {
        return;
      }

      setIsBackingUp(true);
      setError(null);

      try {
        const result = await createFixedMarkdownBackup(serializeBoardMarkdown(board));

        setBackups((currentBackups) => [
          result.backup,
          ...currentBackups.filter(
            (backup) => backup.fileName !== result.backup.fileName,
          ),
        ]);
        writeStoredTimestamp(AUTO_BACKUP_LAST_RUN_KEY, result.backup.createdAt);
        setStatusMessage(reason === "auto" ? "已自动备份" : "已备份");
      } catch (caughtError) {
        setError(toErrorMessage(caughtError, "创建备份失败。"));
      } finally {
        setIsBackingUp(false);
      }
    },
    [board, isBackingUp],
  );

  function handleBackupEnabledChange(enabled: boolean) {
    setBackupEnabled(enabled);
    writeStoredBoolean(AUTO_BACKUP_ENABLED_KEY, enabled);

    if (enabled && readStoredTimestamp(AUTO_BACKUP_LAST_RUN_KEY) === null) {
      writeStoredTimestamp(AUTO_BACKUP_LAST_RUN_KEY, new Date().toISOString());
    }

    setStatusMessage(enabled ? "已开启自动备份" : "已关闭自动备份");
  }

  useEffect(() => {
    if (!backupEnabled || readStoredTimestamp(AUTO_BACKUP_LAST_RUN_KEY) !== null) {
      return;
    }

    writeStoredTimestamp(
      AUTO_BACKUP_LAST_RUN_KEY,
      backups[0]?.createdAt ?? new Date().toISOString(),
    );
  }, [backupEnabled, backups]);

  useEffect(() => {
    if (!backupEnabled || !board) {
      return;
    }

    function maybeCreateBackup() {
      const lastBackupMs = readStoredTimestamp(AUTO_BACKUP_LAST_RUN_KEY);

      if (lastBackupMs === null) {
        writeStoredTimestamp(AUTO_BACKUP_LAST_RUN_KEY, new Date().toISOString());
        return;
      }

      if (Date.now() - lastBackupMs >= AUTO_BACKUP_INTERVAL_MS) {
        void handleCreateBackup("auto");
      }
    }

    maybeCreateBackup();

    const intervalId = window.setInterval(maybeCreateBackup, AUTO_BACKUP_CHECK_MS);
    return () => window.clearInterval(intervalId);
  }, [backupEnabled, board, handleCreateBackup]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  function handleAddCard(columnId: ColumnId) {
    if (!board) {
      return;
    }

    const newCard: Card = {
      id: generateCardId(),
      title: "",
      body: appendStageHistory("", columnId),
      columnId,
    };

    markBoardChanged(addCardToBoard(board, columnId, newCard));
    setSelectedCardId(newCard.id);
  }

  function handleUpdateCard(cardId: string, updates: Pick<Card, "title" | "body">) {
    if (!board) {
      return;
    }

    markBoardChanged(updateCardInBoard(board, cardId, updates));
  }

  function handleDeleteCard(cardId: string) {
    if (!board) {
      return;
    }

    markBoardChanged(deleteCardFromBoard(board, cardId));
    setSelectedCardId(null);
  }

  function handleArchiveCard(cardId: string, updates: Pick<Card, "title" | "body">) {
    if (!board) {
      return;
    }

    markBoardChanged(
      archiveCardInBoard(updateCardInBoard(board, cardId, updates), cardId),
    );
    setSelectedCardId(null);
  }

  function handleRestoreCard(cardId: string, updates: Pick<Card, "title" | "body">) {
    if (!board) {
      return;
    }

    markBoardChanged(
      restoreCardInBoard(updateCardInBoard(board, cardId, updates), cardId),
    );
    setSelectedCardId(null);
  }

  function handleUpdateNotes(notes: string) {
    if (!board) {
      return;
    }

    if (notes === board.notes) {
      return;
    }

    markBoardChanged({ ...board, notes });
  }

  return (
    <div className="app-shell">
      <Toolbar
        fileName={fileName}
        dirty={dirty}
        statusMessage={isLoading ? "正在加载" : statusMessage}
        canSave={Boolean(board)}
        canAddCard={Boolean(board)}
        backupEnabled={backupEnabled}
        backups={backups}
        isBackingUp={isBackingUp}
        onSave={handleSave}
        onAddCard={() => handleAddCard(DEFAULT_NEW_CARD_COLUMN_ID)}
        onEditNotes={() => setNotesEditorOpen(true)}
        onBackupEnabledChange={handleBackupEnabledChange}
        onCreateBackup={() => void handleCreateBackup("manual")}
      />
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {board ? (
        <BoardView
          board={board}
          onBoardChange={markBoardChanged}
          onCardSelect={setSelectedCardId}
        />
      ) : (
        <EmptyState isLoading={isLoading} onReload={loadBoard} />
      )}
      <CardEditor
        card={selectedCard}
        isArchived={selectedCardArchived}
        onSave={handleUpdateCard}
        onDelete={handleDeleteCard}
        onArchive={handleArchiveCard}
        onRestore={handleRestoreCard}
        onClose={() => setSelectedCardId(null)}
      />
      <ProjectNotesEditor
        notes={board?.notes ?? ""}
        open={notesEditorOpen}
        onSave={handleUpdateNotes}
        onClose={() => setNotesEditorOpen(false)}
      />
    </div>
  );
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.localStorage.getItem(key);

  if (value === null) {
    return fallback;
  }

  return value === "true";
}

function writeStoredBoolean(key: string, value: boolean): void {
  window.localStorage.setItem(key, String(value));
}

function readStoredTimestamp(key: string): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(key);

  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function writeStoredTimestamp(key: string, value: string): void {
  window.localStorage.setItem(key, value);
}

function formatStatusTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getSupportDocs(board: Board): SupportMarkdownDoc[] {
  return [
    {
      path: "project-data/notes.md",
      content: serializeNotesMarkdown(board),
    },
    {
      path: "project-data/resources.md",
      content: serializeResourcesMarkdown(board),
    },
    {
      path: "project-data/achievements.md",
      content: serializeAchievementsMarkdown(board),
    },
  ];
}

export default App;
