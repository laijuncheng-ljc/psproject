import type { Board } from "../types/board";
import { resolveCardLinks } from "../utils/cardLinks";

interface LinkedCardModulesProps {
  board: Board;
  text: string;
  onCardSelect?: (cardId: string) => void;
  compact?: boolean;
}

export function LinkedCardModules({
  board,
  text,
  onCardSelect,
  compact = false,
}: LinkedCardModulesProps) {
  const references = resolveCardLinks(board, text);

  if (references.length === 0) {
    return null;
  }

  return (
    <div className={`linked-card-modules${compact ? " is-compact" : ""}`}>
      {!compact ? <h3>链接子模块</h3> : null}
      <div className="linked-card-list">
        {references.map((reference) => {
          const title = reference.card?.title.trim() || reference.id;
          const missing = reference.card === null;
          const cardBody = (
            <>
              <span className="linked-card-title">{title}</span>
              <span className="linked-card-meta">
                {missing
                  ? "未找到"
                  : `${reference.statusLabel} · ${reference.category || "未分类"}`}
                {reference.totalItems > 0
                  ? ` · ${reference.completedItems}/${reference.totalItems}`
                  : ""}
              </span>
              {!compact && reference.detailPath ? (
                <span className="linked-card-detail">{reference.detailPath}</span>
              ) : null}
              {!compact && reference.preview ? (
                <span className="linked-card-preview">{reference.preview}</span>
              ) : null}
            </>
          );

          if (!onCardSelect || missing) {
            return (
              <div
                key={reference.id}
                className={`linked-card-module${missing ? " is-missing" : ""}`}
              >
                {cardBody}
              </div>
            );
          }

          return (
            <button
              key={reference.id}
              type="button"
              className="linked-card-module"
              onClick={() => onCardSelect(reference.id)}
            >
              {cardBody}
            </button>
          );
        })}
      </div>
    </div>
  );
}
