import { useState, useEffect, useRef } from "react";
import { Download, Upload, Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { exportBackup, importBackup, downloadBackupJSON } from "../backup.js";
import {
  initDrive, requestDriveAccess, disconnectDrive, isConnected,
  uploadToDrive, downloadFromDrive, isDriveAvailable,
} from "../drive.js";
import { INK, BG, PRIMARY, GREEN, RED, GRAY } from "../constants.js";

const LAST_BACKUP_KEY = "cuentita_last_backup";

function getLastBackup() {
  const v = localStorage.getItem(LAST_BACKUP_KEY);
  return v ? Number(v) : null;
}
function setLastBackup() {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
}

export default function Settings({ onImportDone }) {
  const [driveReady, setDriveReady] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok'|'error', msg }
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isDriveAvailable()) {
      initDrive((ok) => { setDriveConnected(ok); setDriveReady(true); });
      setDriveReady(true);
    }
  }, []);

  const notify = (type, msg) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  };

  const handleExportLocal = async () => {
    try {
      const backup = await exportBackup();
      downloadBackupJSON(backup);
      setLastBackup();
      notify("ok", "Backup exportado correctamente.");
    } catch (e) {
      notify("error", "Error al exportar: " + e.message);
    }
  };

  const handleImportLocal = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await importBackup(backup);
      notify("ok", "Backup restaurado. Recargando…");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      notify("error", "Error al importar: " + err.message);
    }
  };

  const handleConnectDrive = () => {
    if (!isDriveAvailable()) {
      notify("error", "Google Sign-In no está disponible. Revisá la conexión a internet.");
      return;
    }
    if (!driveReady) {
      initDrive((ok) => { setDriveConnected(ok); setDriveReady(true); });
    }
    requestDriveAccess();
  };

  const handleDisconnectDrive = () => {
    disconnectDrive();
    setDriveConnected(false);
    notify("ok", "Desconectado de Google Drive.");
  };

  const handleUploadDrive = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup();
      await uploadToDrive(backup);
      setLastBackup();
      notify("ok", "Backup subido a Google Drive.");
    } catch (e) {
      notify("error", "Error al subir a Drive: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadDrive = async () => {
    setBusy(true);
    try {
      const backup = await downloadFromDrive();
      await importBackup(backup);
      notify("ok", "Backup restaurado desde Drive. Recargando…");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      notify("error", "Error al restaurar desde Drive: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const lastBackupTs = getLastBackup();
  const lastBackupLabel = lastBackupTs
    ? new Date(lastBackupTs).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Nunca";

  return (
    <div style={{ background: BG, minHeight: "100%", color: INK, padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Ajustes</h1>
        <p style={{ margin: "0 0 28px", fontSize: 14, opacity: 0.55 }}>
          Último backup: {lastBackupLabel}
        </p>

        {status && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 12, marginBottom: 20, background: status.type === "ok" ? `${GREEN}18` : `${RED}18`, color: status.type === "ok" ? GREEN : RED, fontSize: 13.5, fontWeight: 600 }}>
            {status.type === "ok" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {status.msg}
          </div>
        )}

        <Section title="Backup local">
          <p style={hint}>El archivo JSON contiene todos tus datos y puede restaurarse en cualquier momento.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={handleExportLocal} style={btnPrimary}>
              <Download size={15} /> Exportar backup
            </button>
            <button onClick={handleImportLocal} style={btnGhost}>
              <Upload size={15} /> Importar backup
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleFileChange} />
        </Section>

        <Section title="Google Drive">
          <p style={hint}>
            Conectá tu cuenta de Google para subir o restaurar el backup desde Drive. La subida nunca es automática — siempre la iniciás vos.
          </p>
          {!driveConnected ? (
            <button onClick={handleConnectDrive} style={btnPrimary}>
              <Cloud size={15} /> Conectar Google Drive
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: GREEN, fontWeight: 600 }}>
                <CheckCircle size={15} /> Conectado a Google Drive
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={handleUploadDrive} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
                  {busy ? <RefreshCw size={15} className="spin" /> : <Cloud size={15} />}
                  Subir backup a Drive
                </button>
                <button onClick={handleDownloadDrive} disabled={busy} style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }}>
                  <Download size={15} /> Restaurar desde Drive
                </button>
              </div>
              <button onClick={handleDisconnectDrive} style={{ ...btnGhost, alignSelf: "flex-start", fontSize: 12.5, padding: "6px 12px" }}>
                <CloudOff size={13} /> Desconectar Drive
              </button>
            </div>
          )}
        </Section>

        <Section title="Sobre la app">
          <p style={{ ...hint, marginBottom: 0 }}>
            <strong>Cuentita v1.0</strong><br />
            Tus datos se guardan localmente en este dispositivo. Usá el backup para llevarlos a otro dispositivo o como respaldo.
          </p>
        </Section>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.5, margin: "0 0 12px" }}>{title}</h2>
      <div style={{ background: "#fff", borderRadius: 16, padding: "16px" }}>
        {children}
      </div>
    </div>
  );
}

const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, background: PRIMARY, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: INK, border: `1.5px solid ${INK}33`, borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const hint = { fontSize: 13, opacity: 0.6, lineHeight: 1.5, marginTop: 0, marginBottom: 14 };
