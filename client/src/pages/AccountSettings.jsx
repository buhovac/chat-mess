import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.jsx";
import { Avatar } from "../components/Avatar.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";

// Client-side checks below are for quick feedback only — the server
// re-validates everything with zod (same bounds as registration).
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function ProfileSection() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [status, setStatus] = useState(null); // null | { ok, text }
  const [submitting, setSubmitting] = useState(false);

  const trimmed = displayName.trim();
  const unchanged = trimmed === user.displayName;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      await updateProfile({ displayName: trimmed });
      setStatus({ ok: true, text: "Nom mis à jour." });
    } catch (err) {
      setStatus({ ok: false, text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="settings-section" onSubmit={handleSubmit}>
      <h3>Profil</h3>
      <div className="settings-avatar-row">
        <Avatar user={{ id: user.id, displayName: trimmed || user.displayName }} size="lg" />
        <p className="settings-hint">L'avatar est généré à partir de tes initiales.</p>
      </div>
      <label>
        Nom affiché
        <input value={displayName} maxLength={100} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      {status && <p className={status.ok ? "settings-success" : "auth-error"}>{status.text}</p>}
      <button type="submit" disabled={submitting || !trimmed || unchanged}>
        Enregistrer
      </button>
    </form>
  );
}

function PasswordSection() {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const mismatch = confirmation.length > 0 && newPassword !== confirmation;

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirmation) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setStatus({ ok: true, text: "Mot de passe modifié. Tes autres sessions ont été déconnectées." });
    } catch (err) {
      setStatus({ ok: false, text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="settings-section" onSubmit={handleSubmit}>
      <h3>Mot de passe</h3>
      <label>
        Mot de passe actuel
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          maxLength={PASSWORD_MAX}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </label>
      <label>
        Nouveau mot de passe ({PASSWORD_MIN} caractères minimum)
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </label>
      <label>
        Confirmer le nouveau mot de passe
        <input
          type="password"
          autoComplete="new-password"
          value={confirmation}
          maxLength={PASSWORD_MAX}
          onChange={(e) => setConfirmation(e.target.value)}
          required
        />
      </label>
      {mismatch && <p className="auth-error">Les deux mots de passe ne correspondent pas.</p>}
      {status && <p className={status.ok ? "settings-success" : "auth-error"}>{status.text}</p>}
      <button type="submit" disabled={submitting || mismatch || newPassword.length < PASSWORD_MIN}>
        Changer le mot de passe
      </button>
    </form>
  );
}

function DeleteAccountSection() {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function closeDialog() {
    setDialogOpen(false);
    setCurrentPassword("");
    setError(null);
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteAccount({ currentPassword });
      navigate("/login", { replace: true });
    } catch (err) {
      // Wrong password: the dialog stays open so it can be retyped.
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <section className="settings-section settings-section--danger">
      <h3>Supprimer le compte</h3>
      <p className="settings-hint">
        Action irréversible. Tes messages restent visibles pour les autres, signés « Utilisateur supprimé ». Si tu
        es propriétaire d'un groupe, la propriété passe au membre le plus ancien (administrateur en priorité).
      </p>
      <button className="danger-button" onClick={() => setDialogOpen(true)}>
        Supprimer mon compte
      </button>

      {dialogOpen && (
        <ConfirmDialog
          title="Supprimer ton compte ?"
          message="Tape ton mot de passe actuel pour confirmer. Cette action ne peut pas être annulée."
          confirmLabel={submitting ? "Suppression..." : "Supprimer définitivement"}
          confirmDisabled={submitting || currentPassword.length === 0}
          onConfirm={handleConfirm}
          onCancel={closeDialog}
        >
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Mot de passe actuel"
            value={currentPassword}
            maxLength={PASSWORD_MAX}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          {error && <p className="auth-error">{error}</p>}
        </ConfirmDialog>
      )}
    </section>
  );
}

export default function AccountSettings() {
  return (
    <section className="settings-page">
      <h2>Paramètres du compte</h2>
      <ProfileSection />
      <PasswordSection />
      <DeleteAccountSection />
    </section>
  );
}
