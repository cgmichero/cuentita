import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Overlay from "./Overlay.jsx";
import Icon, { ICON_NAMES } from "./Icon.jsx";
import { INK, BG, COLOR_PALETTE } from "../constants.js";
import { uid } from "../utils.js";

const inputStyle = { width: "100%", border: `1.5px solid ${INK}26`, borderRadius: 10, padding: "9px 10px", fontSize: 14, background: "#fff", color: INK, boxSizing: "border-box" };
const iconBtn = { background: "none", border: "none", color: INK, padding: 4 };
const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, background: "#4F46E5", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 700 };

// movements is optional; when provided, prevents deletion of categories in use
export default function CategoryManager({ categories, movements = [], onClose, onChange }) {
  const [name, setName] = useState("");
  const [pickerFor, setPickerFor] = useState(null);
  const [pickerTab, setPickerTab] = useState("icon");

  const usedCount = (id) => movements.filter((m) => m.category === id).length;

  const addCat = () => {
    if (!name.trim()) return;
    onChange([...categories, { id: uid(), name: name.trim(), color: COLOR_PALETTE[categories.length % COLOR_PALETTE.length], icon: "Package" }]);
    setName("");
  };

  const removeCat = (id) => {
    if (usedCount(id) > 0) return;
    onChange(categories.filter((c) => c.id !== id));
  };

  const openPicker = (id) => { setPickerFor(pickerFor === id ? null : id); setPickerTab("icon"); };
  const renameCat = (id, newName) => onChange(categories.map((c) => (c.id === id ? { ...c, name: newName } : c)));
  const setIcon = (id, icon) => onChange(categories.map((c) => (c.id === id ? { ...c, icon } : c)));
  const setColor = (id, color) => onChange(categories.map((c) => (c.id === id ? { ...c, color } : c)));

  return (
    <Overlay onClose={onClose} title="Categorías">
      {categories.map((c) => (
        <div key={c.id} style={{ borderBottom: `1px solid ${INK}10`, padding: "10px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => openPicker(c.id)}
              style={{ width: 32, height: 32, borderRadius: 9, background: c.color, border: "none", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Elegir ícono o color"
            >
              <Icon name={c.icon} size={16} color="#fff" />
            </button>
            <input value={c.name} onChange={(e) => renameCat(c.id, e.target.value)} style={{ ...inputStyle, flex: 1, padding: "6px 8px" }} />
            <button
              onClick={() => removeCat(c.id)}
              disabled={usedCount(c.id) > 0}
              title={usedCount(c.id) > 0 ? "En uso, no se puede eliminar" : "Eliminar"}
              style={{ ...iconBtn, opacity: usedCount(c.id) > 0 ? 0.3 : 0.65 }}
            >
              <Trash2 size={15} />
            </button>
          </div>

          {pickerFor === c.id && (
            <div style={{ marginTop: 8, padding: 8, background: BG, borderRadius: 10 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button onClick={() => setPickerTab("icon")} style={{ flex: 1, padding: "5px 0", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600, background: pickerTab === "icon" ? "#fff" : "transparent", color: INK }}>Ícono</button>
                <button onClick={() => setPickerTab("color")} style={{ flex: 1, padding: "5px 0", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600, background: pickerTab === "color" ? "#fff" : "transparent", color: INK }}>Color</button>
              </div>
              {pickerTab === "icon" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                  {ICON_NAMES.map((iconName) => (
                    <button key={iconName} onClick={() => setIcon(c.id, iconName)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: "center", background: c.icon === iconName ? c.color : "#fff" }}>
                      <Icon name={iconName} size={15} color={c.icon === iconName ? "#fff" : INK} />
                    </button>
                  ))}
                </div>
              )}
              {pickerTab === "color" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {COLOR_PALETTE.map((col) => (
                    <button key={col} onClick={() => setColor(c.id, col)} style={{ width: 30, height: 30, borderRadius: "50%", border: c.color === col ? `2.5px solid ${INK}` : "2.5px solid transparent", background: col, padding: 0 }} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCat()}
          placeholder="Nueva categoría"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={addCat} style={btnPrimary}><Plus size={15} /></button>
      </div>
    </Overlay>
  );
}
