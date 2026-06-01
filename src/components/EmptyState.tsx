interface EmptyStateProps {
  isLoading: boolean;
  onReload: () => void;
}

export function EmptyState({ isLoading, onReload }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state-inner">
        <h2>{isLoading ? "正在载入看板" : "无法载入看板"}</h2>
        <p>{isLoading ? "正在读取项目里的 board.md。" : "请确认本地服务正在运行。"}</p>
        {!isLoading ? (
          <button type="button" className="button-primary" onClick={onReload}>
            重新载入
          </button>
        ) : null}
      </div>
    </section>
  );
}
