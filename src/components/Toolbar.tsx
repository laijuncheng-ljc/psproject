interface ToolbarProps {
  fileName: string | null;
  dirty: boolean;
  statusMessage: string | null;
  canUseFiles: boolean;
  canSave: boolean;
  onOpen: () => void;
  onSave: () => void;
}

export function Toolbar({
  fileName,
  dirty,
  statusMessage,
  canUseFiles,
  canSave,
  onOpen,
  onSave,
}: ToolbarProps) {
  const status = getStatusText(fileName, dirty, statusMessage);
  const statusClass = dirty ? "status status-dirty" : "status";

  return (
    <header className="toolbar">
      <div className="toolbar-title">
        <h1>Local MD Kanban</h1>
        <span className="file-name">{fileName ?? "No file opened"}</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" onClick={onOpen} disabled={!canUseFiles}>
          Open
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={onSave}
          disabled={!canSave}
        >
          Save
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
    return "No file opened";
  }

  if (dirty) {
    return "Unsaved changes";
  }

  return statusMessage ?? "Saved";
}
