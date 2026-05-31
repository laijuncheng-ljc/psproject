interface EmptyStateProps {
  canUseFiles: boolean;
  onOpen: () => void;
}

export function EmptyState({ canUseFiles, onOpen }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state-inner">
        <h2>Local MD Kanban</h2>
        <p>
          {canUseFiles
            ? "Open a local Markdown file to start."
            : "当前浏览器不支持本地文件读写。请使用 Chrome 或 Edge 桌面版。"}
        </p>
        <button
          type="button"
          className="button-primary"
          onClick={onOpen}
          disabled={!canUseFiles}
        >
          Open Markdown File
        </button>
      </div>
    </section>
  );
}
