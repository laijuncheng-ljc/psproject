interface ToolbarProps {
  fileName: string | null;
  dirty: boolean;
  statusMessage: string | null;
  canUseFiles: boolean;
  canSave: boolean;
  canAddCard: boolean;
  onOpen: () => void;
  onSave: () => void;
  onAddCard: () => void;
}

export function Toolbar({
  fileName,
  dirty,
  statusMessage,
  canUseFiles,
  canSave,
  canAddCard,
  onOpen,
  onSave,
  onAddCard,
}: ToolbarProps) {
  const status = getStatusText(fileName, dirty, statusMessage);
  const statusClass = dirty ? "status status-dirty" : "status";

  return (
    <header className="toolbar">
      <div className="toolbar-title">
        <h1>本地 MD 看板</h1>
        <span className="file-name">{fileName ?? "未打开文件"}</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" onClick={onOpen} disabled={!canUseFiles}>
          打开
        </button>
        <button type="button" onClick={onAddCard} disabled={!canAddCard}>
          新建卡片
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={onSave}
          disabled={!canSave}
        >
          保存
        </button>
        <span className={statusClass}>{status}</span>
      </div>
    </header>
  );
}

function getStatusText(
  fileName: string | null,
  dirty: boolean,
  statusMessage: string | null,
): string {
  if (!fileName) {
    return "未打开文件";
  }

  if (dirty) {
    return "未保存";
  }

  return statusMessage ?? "已保存";
}
