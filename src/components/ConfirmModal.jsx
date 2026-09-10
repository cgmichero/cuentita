import Overlay from "./Overlay.jsx";
import { INK, PRIMARY } from "../constants.js";

const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, background: PRIMARY, color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 700 };
const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: INK, border: `1.5px solid ${INK}33`, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600 };

export default function ConfirmModal({ title, message, confirmLabel, onCancel, onConfirm }) {
  return (
    <Overlay onClose={onCancel} title={title}>
      <p style={{ fontSize: 14, lineHeight: 1.5, marginTop: -4 }}>{message}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Cancelar</button>
        <button onClick={onConfirm} style={{ ...btnPrimary, flex: 1, justifyContent: "center" }}>{confirmLabel}</button>
      </div>
    </Overlay>
  );
}
