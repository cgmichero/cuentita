import { X } from "lucide-react";
import { INK } from "../constants.js";

export default function Overlay({ children, onClose, title }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: `${INK}66`, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", padding: 20, maxHeight: "85vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none" }}><X size={18} color={INK} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
