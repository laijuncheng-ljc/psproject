import { useState } from "react";

interface ProjectNotesEditorProps {
  notes: string;
  open: boolean;
  onSave: (notes: string) => void;
  onClose: () => void;
}

export function ProjectNotesEditor({
  notes,
  open,
  onSave,
  onClose,
}: ProjectNotesEditorProps) {
  if (!open) {
    return null;
  }

  return (
    <ProjectNotesEditorForm
      notes={notes}
      onSave={onSave}
      onClose={onClose}
    />
  );
}

type ProjectNotesEditorFormProps = Pick<
  ProjectNotesEditorProps,
  "notes" | "onSave" | "onClose"
>;

function ProjectNotesEditorForm({
  notes,
  onSave,
  onClose,
}: ProjectNotesEditorFormProps) {
  const [draftNotes, setDraftNotes] = useState(notes);

  function commitAndClose() {
    onSave(draftNotes);
    onClose();
  }

  return (
    <aside className="card-editor project-notes-editor" aria-label="项目备注编辑器">
      <div className="editor-header">
        <h2>项目备注</h2>
        <button type="button" className="icon-button" onClick={commitAndClose}>
          关闭
        </button>
      </div>
      <label className="editor-body-field">
        <span>备注</span>
        <textarea
          value={draftNotes}
          onChange={(event) => setDraftNotes(event.target.value)}
        />
      </label>
      <div className="editor-actions editor-actions-right">
        <button type="button" className="button-primary" onClick={commitAndClose}>
          完成
        </button>
      </div>
    </aside>
  );
}
