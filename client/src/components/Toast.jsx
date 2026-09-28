import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);
const AUTO_DISMISS_MS = 5000;
const MAX_TOASTS = 3;

// A stack (Stage 5): more than one "new message" notification can arrive
// close together, so this replaced the earlier single-message toast.
// Capped at MAX_TOASTS — a burst drops the oldest rather than flooding the
// screen. showToast still accepts a plain string for existing callers
// (e.g. "removed from conversation") alongside the richer { text, onClick }.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (input) => {
      const toast = typeof input === "string" ? { text: input } : input;
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, ...toast }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast${toast.onClick ? " toast--clickable" : ""}`}
            role="status"
            onClick={() => {
              toast.onClick?.();
              dismiss(toast.id);
            }}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
