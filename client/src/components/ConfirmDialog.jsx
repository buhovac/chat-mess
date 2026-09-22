// Non-blocking replacement for window.confirm(): a native confirm() freezes
// the whole tab (including any automated testing driving it) until
// dismissed, and looks inconsistent with the rest of the UI — this follows
// the same dialog-backdrop/dialog pattern as NewConversationDialog.
export function ConfirmDialog({ title, message, confirmLabel = "Confirmer", onConfirm, onCancel }) {
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="dialog-close-button" onClick={onCancel}>
            Annuler
          </button>
          <button className="danger-button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
