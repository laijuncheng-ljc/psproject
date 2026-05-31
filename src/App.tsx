import { useCallback, useEffect, useMemo, useState } from "react";
import { BoardView } from "./components/BoardView";
import { CardEditor } from "./components/CardEditor";
import { EmptyState } from "./components/EmptyState";
import { ErrorBanner } from "./components/ErrorBanner";
import { Toolbar } from "./components/Toolbar";
import { parseBoardMarkdown } from "./markdown/parseBoardMarkdown";
import { serializeBoardMarkdown } from "./markdown/serializeBoardMarkdown";
import {
  UNSUPPORTED_MESSAGE,
  type OpenedMarkdownFile,
  openMarkdownFile,
  saveMarkdownFile,
  supportsLocalMarkdownFiles,
} from "./storage/localMarkdownFile";
import type { Board, Card, ColumnId } from "./types/board";
import {
  addCardToBoard,
  deleteCardFromBoard,
  getCardById,
  updateCardInBoard,
} from "./utils/board";
import { generateCardId } from "./utils/id";

const DEFAULT_NEW_CARD_COLUMN_ID: ColumnId = "todo";

function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [openedFile, setOpenedFile] = useState<OpenedMarkdownFile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const canUseFiles = supportsLocalMarkdownFiles();

  const selectedCard = useMemo(
    () => (board && selectedCardId ? getCardById(board, selectedCardId) : null),
    [board, selectedCardId],
  );

  const markBoardChanged = useCallback((nextBoard: Board) => {
    setBoard(nextBoard);
    setDirty(true);
    setStatusMessage(null);
  }, []);

  const handleOpen = useCallback(async () => {
    setError(null);
    setStatusMessage(null);

    try {
      const file = await openMarkdownFile();
      const parsedBoard = parseBoardMarkdown(file.content);

      setOpenedFile(file);
      setBoard(parsedBoard);
      setDirty(false);
      setSelectedCardId(null);
      setStatusMessage("已保存");
    } catch (caughtError) {
      if (isAbortError(caughtError)) {
        return;
      }

      setError(toErrorMessage(caughtError, "打开 Markdown 文件失败。"));
    }
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);

    if (!board) {
      setError("没有可保存的看板。");
      return;
    }

    if (!openedFile) {
      setError("还没有打开文件。");
      return;
    }

    try {
      await saveMarkdownFile(openedFile.handle, serializeBoardMarkdown(board));
      setDirty(false);
      setStatusMessage("已保存");
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "保存 Markdown 文件失败。"));
    }
  }, [board, openedFile]);

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
      title: "未命名卡片",
      body: "",
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

  return (
    <div className="app-shell">
      <Toolbar
        fileName={openedFile?.name ?? null}
        dirty={dirty}
        statusMessage={statusMessage}
        canUseFiles={canUseFiles}
        canSave={Boolean(board && openedFile)}
        canAddCard={Boolean(board)}
        onOpen={handleOpen}
        onSave={handleSave}
        onAddCard={() => handleAddCard(DEFAULT_NEW_CARD_COLUMN_ID)}
      />
      {!canUseFiles ? <ErrorBanner message={UNSUPPORTED_MESSAGE} /> : null}
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {board ? (
        <BoardView
          board={board}
          onBoardChange={markBoardChanged}
          onCardSelect={setSelectedCardId}
        />
      ) : (
        <EmptyState canUseFiles={canUseFiles} onOpen={handleOpen} />
      )}
      <CardEditor
        card={selectedCard}
        onSave={handleUpdateCard}
        onDelete={handleDeleteCard}
        onClose={() => setSelectedCardId(null)}
      />
    </div>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default App;
