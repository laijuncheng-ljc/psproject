interface EmptyStateProps {
  canUseFiles: boolean;
  onOpen: () => void;
}

export function EmptyState({ canUseFiles, onOpen }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state-inner">
        <h2>本地 MD 看板</h2>
        <p>
          {canUseFiles
            ? "打开一个本地 Markdown 文件开始使用。"
            : "当前浏览器不支持本地文件读写。请使用 Chrome 或 Edge 桌面版。"}
        </p>
        <button
          type="button"
          className="button-primary"
          onClick={onOpen}
          disabled={!canUseFiles}
        >
          打开 Markdown 文件
        </button>
      </div>
    </section>
  );
}
