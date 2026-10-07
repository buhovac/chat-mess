// Non-blocking replacement for window.confirm(): a native confirm() freezes
// the whole tab (including any automated testing driving it) until
// dismissed, and looks inconsistent with the rest of the UI — this follows
// the same dialog-backdrop/dialog pattern as NewConversationDialog.
// `children` is for confirmations that need input (account deletion asks
// for the password), with `confirmDisabled` holding the button until it's valid.
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmer",
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}) {
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        {children}
        <div className="dialog-actions">
          <button className="dialog-close-button" onClick={onCancel}>
            Annuler
          </button>
          <button className="danger-button" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
