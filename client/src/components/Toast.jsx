import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);
const AUTO_DISMISS_MS = 5000;

// Single global toast (not a stack) — this app only ever has one thing to
// say at a time (e.g. "you were removed from this conversation"), so a
// queue would be unused complexity.
export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);
  const timeoutRef = useRef(null);

  const showToast = useCallback((text) => {
    clearTimeout(timeoutRef.current);
    setMessage(text);
    timeoutRef.current = setTimeout(() => setMessage(null), AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
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
