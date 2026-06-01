import type { BackupSnapshot } from "../storage/fixedMarkdownFile";

interface ToolbarProps {
  fileName: string | null;
  dirty: boolean;
  statusMessage: string | null;
  canSave: boolean;
  canAddCard: boolean;
  backupEnabled: boolean;
  backups: BackupSnapshot[];
  isBackingUp: boolean;
  onSave: () => void;
  onAddCard: () => void;
  onEditNotes: () => void;
  onBackupEnabledChange: (enabled: boolean) => void;
  onCreateBackup: () => void;
}

export function Toolbar({
  fileName,
  dirty,
  statusMessage,
  canSave,
  canAddCard,
  backupEnabled,
  backups,
  isBackingUp,
  onSave,
  onAddCard,
  onEditNotes,
  onBackupEnabledChange,
  onCreateBackup,
}: ToolbarProps) {
  const status = getStatusText(fileName, dirty, statusMessage);
  const statusClass = dirty ? "status status-dirty" : "status";

  return (
    <header className="toolbar">
      <div className="toolbar-title">
        <h1>本地 MD 看板</h1>
        <span className="file-name">{fileName ?? "board.md"}</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" onClick={onAddCard} disabled={!canAddCard}>
          新建卡片
        </button>
        <button type="button" onClick={onEditNotes} disabled={!canSave}>
          项目备注
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={onSave}
          disabled={!canSave}
        >
          保存
        </button>
        <details className="backup-history">
          <summary>备份历史</summary>
          <div className="backup-panel">
            <label className="backup-toggle">
              <input
                type="checkbox"
                checked={backupEnabled}
                onChange={(event) => onBackupEnabledChange(event.target.checked)}
              />
              <span>每 2 小时自动备份</span>
            </label>
            <button
              type="button"
              onClick={onCreateBackup}
              disabled={isBackingUp || !canSave}
            >
              {isBackingUp ? "备份中" : "立即备份"}
            </button>
            <BackupHistoryList backups={backups} />
          </div>
        </details>
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
    return statusMessage ?? "正在加载";
  }

  if (dirty) {
    return "未保存";
  }

  return statusMessage ?? "已保存";
}

interface BackupHistoryListProps {
  backups: BackupSnapshot[];
}

function BackupHistoryList({ backups }: BackupHistoryListProps) {
  const recentBackups = backups.slice(0, 5);

  if (recentBackups.length === 0) {
    return <p className="backup-empty">暂无备份</p>;
  }

  return (
    <ol className="backup-list">
      {recentBackups.map((backup) => (
        <li key={backup.fileName}>
          <span>{formatBackupTime(backup.createdAt)}</span>
          <strong>{backup.fileName}</strong>
        </li>
      ))}
    </ol>
  );
}

function formatBackupTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
