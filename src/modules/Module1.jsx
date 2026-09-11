import { useState, useEffect, useRef } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Plus, Pencil, X, Clock, ArrowUpRight, ArrowDownRight, Trash2, Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { dbGet, dbSet } from "../db.js";
import { INK, BG, GREEN, RED, GRAY, PRIMARY, DEFAULT_CATEGORIES } from "../constants.js";
import { fmt, fmtCompact, todayStr, uid, monthKey, monthLabel, downloadCSV } from "../utils.js";
import Overlay from "../components/Overlay.jsx";
import Field from "../components/Field.jsx";
import Icon from "../components/Icon.jsx";
import CategoryManager from "../components/CategoryManager.jsx";

export default function Module1({ categories, onCategoriesChange }) {
  const [loaded, setLoaded] = useState(false);
  const [movements, setMovements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editComment, setEditComment] = useState("");
  const [historyFor, setHistoryFor] = useState(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const csvInputRef = useRef(null);
  const [chartTab, setChartTab] = useState("categoria");
  const [filterType, setFilterType] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  const currentMonth = todayStr().slice(0, 7);
  const currentYear = currentMonth.slice(0, 4);
  const [viewMode, setViewMode] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useEffect(() => {
    (async () => {
      let movs = [];
      try {
        const m = await dbGet("movements");
        if (m) movs = JSON.parse(m);
      } catch (e) {}
      // one-time migration: rename old "comida" category refs in movements
      movs = movs.map((m) => m.category === "comida" ? { ...m, category: "comida_bebida" } : m);
      setMovements(movs);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    dbSet("movements", JSON.stringify(movements)).catch(() => {});
  }, [movements, loaded]);

  const monthsSet = Array.from(new Set(movements.map((m) => monthKey(m.date))));
  const availableMonths = Array.from(new Set([...monthsSet, currentMonth])).sort().reverse();
  const availableYears = Array.from(new Set([...monthsSet.map((mk) => mk.slice(0, 4)), currentYear])).sort().reverse();

  const periodMovements =
    viewMode === "month"
      ? movements.filter((m) => monthKey(m.date) === selectedMonth)
      : movements.filter((m) => m.date.slice(0, 4) === selectedYear);

  const income = periodMovements.filter((m) => m.type === "income").reduce((s, m) => s + m.amount, 0);
  const expense = periodMovements.filter((m) => m.type === "expense").reduce((s, m) => s + m.amount, 0);
  const balance = income - expense;
  const balanceColor = balance > 0 ? GREEN : balance < 0 ? RED : GRAY;

  const pieData = categories
    .map((c) => ({
      name: c.name,
      value: periodMovements.filter((m) => m.type === "expense" && m.category === c.id).reduce((s, m) => s + m.amount, 0),
      color: c.color,
    }))
    .filter((d) => d.value > 0);

  const barData = Array.from(new Set(monthsSet)).sort().slice(-6).map((mk) => ({
    month: monthLabel(mk),
    Ingresos: movements.filter((m) => monthKey(m.date) === mk && m.type === "income").reduce((s, m) => s + m.amount, 0),
    Gastos: movements.filter((m) => monthKey(m.date) === mk && m.type === "expense").reduce((s, m) => s + m.amount, 0),
  }));

  const visibleMovements = periodMovements
    .filter((m) => filterType === "all" || m.type === filterType)
    .filter((m) => filterCat === "all" || m.category === filterCat)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const findCat = (id) => categories.find((c) => c.id === id);
  const catName = (id) => findCat(id)?.name || "Sin categoría";
  const catColor = (id) => findCat(id)?.color || GRAY;
  const catIcon = (id) => findCat(id)?.icon || "Package";

  const saveNew = (data) => {
    setMovements((prev) => [...prev, { id: uid(), ...data, history: [] }]);
    setShowForm(false);
  };

  const saveEdit = (data) => {
    setMovements((prev) =>
      prev.map((m) => {
        if (m.id !== editing.id) return m;
        const prevSnapshot = { amount: m.amount, category: m.category, description: m.description, date: m.date, type: m.type };
        return { ...m, ...data, history: [...m.history, { at: new Date().toISOString(), comment: editComment, previous: prevSnapshot }] };
      })
    );
    setEditing(null);
    setEditComment("");
  };

  const deleteMovement = (id) => setMovements((prev) => prev.filter((m) => m.id !== id));

  const exportCSV = () => {
    const rows = [
      ["Fecha", "Tipo", "Categoría", "Descripción", "Monto"],
      ...periodMovements
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((m) => [m.date, m.type === "income" ? "Ingreso" : "Gasto", catName(m.category), m.description, m.amount]),
    ];
    downloadCSV(`gastos_${viewMode === "month" ? selectedMonth : selectedYear}.csv`, rows);
  };

  const handleCSVFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const text = await file.text();
    const preview = parseImportCSV(text, categories);
    setCsvPreview(preview);
  };

  const confirmImport = () => {
    if (!csvPreview) return;
    const newMovements = csvPreview.valid.map(({ date, type, amount, category, description }) => ({
      id: uid(), date, type, amount, category, description, history: [],
    }));
    setMovements((prev) => [...prev, ...newMovements]);
    setCsvPreview(null);
  };

  if (!loaded) return <div style={{ padding: 40, color: INK }}>Cargando…</div>;

  return (
    <div style={{ background: BG, minHeight: "100%", color: INK, padding: "20px 16px 60px" }}>
      <header style={{ maxWidth: 640, margin: "0 auto 20px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Libro de gastos</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <TabButton active={viewMode === "month"} onClick={() => setViewMode("month")}>Mes</TabButton>
          <TabButton active={viewMode === "year"} onClick={() => setViewMode("year")}>Año</TabButton>
          {viewMode === "month" ? (
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={selectStyle}>
              {availableMonths.map((mk) => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
            </select>
          ) : (
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={selectStyle}>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      </header>

      <section style={{ maxWidth: 640, margin: "0 auto 24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <StatBox label="Ingresos" value={income} bg={GREEN} icon={<ArrowUpRight size={16} />} />
        <StatBox label="Gastos" value={expense} bg={RED} icon={<ArrowDownRight size={16} />} />
        <StatBox label="Balance" value={balance} bg={balanceColor} signed />
      </section>

      <section style={{ maxWidth: 640, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <TabButton active={chartTab === "categoria"} onClick={() => setChartTab("categoria")}>Por categoría</TabButton>
          <TabButton active={chartTab === "mensual"} onClick={() => setChartTab("mensual")}>Por mes</TabButton>
        </div>

        {chartTab === "categoria" && (
          pieData.length > 0 ? (
            <div style={{ height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={3}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke={BG} strokeWidth={2} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "inherit", fontSize: 13, borderRadius: 8, border: `1px solid ${INK}22` }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart text="Todavía no hay gastos este mes." />
          )
        )}

        {chartTab === "mensual" && (
          barData.length > 1 ? (
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="2 4" stroke={`${INK}18`} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: INK }} axisLine={{ stroke: `${INK}33` }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} width={40} tickFormatter={fmtCompact} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${INK}22` }} />
                  <Bar dataKey="Ingresos" fill={GREEN} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos" fill={RED} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart text="Necesitás movimientos en al menos 2 meses para comparar." />
          )
        )}
      </section>

      <section style={{ maxWidth: 640, margin: "0 auto 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setShowForm(true)} style={btnPrimary}><Plus size={15} /> Nuevo movimiento</button>
        <button onClick={() => setShowCatManager(true)} style={btnGhost}>Categorías</button>
        <button onClick={exportCSV} style={btnGhost} title="Exportar a CSV"><Download size={14} /> CSV</button>
        <button onClick={() => csvInputRef.current?.click()} style={btnGhost} title="Importar CSV"><Upload size={14} /> Importar</button>
        <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleCSVFile} />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
          <option value="all">Todos</option>
          <option value="income">Ingresos</option>
          <option value="expense">Gastos</option>
        </select>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={selectStyle}>
          <option value="all">Toda categoría</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </section>

      <section style={{ maxWidth: 640, margin: "0 auto" }}>
        {visibleMovements.length === 0 && (
          <p style={{ opacity: 0.55, fontSize: 14, padding: "20px 0" }}>No hay movimientos todavía. Agregá el primero.</p>
        )}
        {visibleMovements.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px", borderBottom: `1px solid ${INK}12` }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: catColor(m.category), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={catIcon(m.category)} size={17} color="#fff" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{m.description || catName(m.category)}</div>
              <div style={{ fontSize: 12, opacity: 0.55 }}>{catName(m.category)} · {m.date}</div>
            </div>
            <div className="num" style={{ fontSize: 15, fontWeight: 700, color: m.type === "income" ? GREEN : RED, whiteSpace: "nowrap" }}>
              {m.type === "income" ? "+" : "−"}{fmt(m.amount)}
            </div>
            {m.history?.length > 0 && (
              <button onClick={() => setHistoryFor(m)} style={iconBtn} title="Ver historial"><Clock size={15} /></button>
            )}
            <button onClick={() => { setEditing(m); setEditComment(""); }} style={iconBtn} title="Editar"><Pencil size={15} /></button>
            <button onClick={() => deleteMovement(m.id)} style={iconBtn} title="Eliminar"><Trash2 size={15} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <MovementModal title="Nuevo movimiento" categories={categories} onCancel={() => setShowForm(false)} onSave={saveNew} />
      )}
      {editing && (
        <MovementModal
          title="Editar movimiento"
          categories={categories}
          initial={editing}
          requireComment
          comment={editComment}
          onCommentChange={setEditComment}
          onCancel={() => { setEditing(null); setEditComment(""); }}
          onSave={saveEdit}
        />
      )}
      {historyFor && (
        <Overlay onClose={() => setHistoryFor(null)} title="Historial de cambios">
          {historyFor.history.slice().reverse().map((h, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${INK}10` }}>
              <div style={{ fontSize: 12, opacity: 0.55 }}>{new Date(h.at).toLocaleString("es-ES")}</div>
              <div style={{ fontSize: 13.5, margin: "3px 0" }}>
                Antes: <span className="num">{fmt(h.previous.amount)}</span> · {catName(h.previous.category)} · {h.previous.description || "—"} · {h.previous.date}
              </div>
              <div style={{ fontSize: 13.5, fontStyle: "italic" }}>"{h.comment}"</div>
            </div>
          ))}
        </Overlay>
      )}
      {showCatManager && (
        <CategoryManager
          categories={categories}
          movements={movements}
          onClose={() => setShowCatManager(false)}
          onChange={onCategoriesChange}
        />
      )}
      {csvPreview && (
        <CSVPreviewModal
          preview={csvPreview}
          onCancel={() => setCsvPreview(null)}
          onConfirm={confirmImport}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, bg, icon, signed }) {
  return (
    <div style={{ background: bg, borderRadius: 16, padding: "14px 10px", color: "#fff" }}>
      <div style={{ fontSize: 11.5, opacity: 0.85, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>{icon}{label}</div>
      <div className="num" style={{ fontSize: 19, marginTop: 6, fontWeight: 800, lineHeight: 1.1 }}>
        {signed && value > 0 ? "+" : ""}{fmtCompact(value)}
      </div>
      <div className="num" style={{ fontSize: 10.5, opacity: 0.75, marginTop: 2 }}>{fmt(Math.abs(value))}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "none", background: active ? PRIMARY : `${INK}0D`, color: active ? "#fff" : INK }}>
      {children}
    </button>
  );
}

function EmptyChart({ text }) {
  return (
    <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5, fontSize: 13.5 }}>{text}</div>
  );
}

function MovementModal({ title, categories, initial, requireComment, comment, onCommentChange, onCancel, onSave }) {
  const [type, setType] = useState(initial?.type || "expense");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [category, setCategory] = useState(initial?.category || categories[0]?.id);
  const [description, setDescription] = useState(initial?.description || "");
  const [date, setDate] = useState(initial?.date || todayStr());

  const canSave = amount && Number(amount) > 0 && category && date && (!requireComment || comment?.trim().length > 0);

  return (
    <Overlay onClose={onCancel} title={title}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["expense", "income"].map((t) => (
          <button key={t} onClick={() => setType(t)} style={{ ...toggleBtn, ...(type === t ? { background: t === "income" ? GREEN : RED, color: "#fff", borderColor: t === "income" ? GREEN : RED } : {}) }}>
            {t === "expense" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>
      <Field label="Monto">
        <input className="num" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
      </Field>
      <Field label="Categoría">
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Descripción">
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} placeholder="Ej: Supermercado" />
      </Field>
      <Field label="Fecha">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
      </Field>
      {requireComment && (
        <Field label="Motivo del cambio (obligatorio)">
          <textarea value={comment} onChange={(e) => onCommentChange(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="¿Por qué se modifica este movimiento?" />
        </Field>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Cancelar</button>
        <button disabled={!canSave} onClick={() => onSave({ type, amount: Number(amount), category, description, date })} style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: canSave ? 1 : 0.4 }}>Guardar</button>
      </div>
    </Overlay>
  );
}

const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, background: PRIMARY, color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 700 };
const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: INK, border: `1.5px solid ${INK}33`, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600 };
const iconBtn = { background: "none", border: "none", color: INK, opacity: 0.65, padding: 4 };
const selectStyle = { border: `1.5px solid ${INK}26`, borderRadius: 10, padding: "8px 8px", fontSize: 13, background: "#fff", color: INK };
const inputStyle = { width: "100%", border: `1.5px solid ${INK}26`, borderRadius: 10, padding: "9px 10px", fontSize: 14, background: "#fff", color: INK, boxSizing: "border-box" };
const toggleBtn = { flex: 1, padding: "8px 0", borderRadius: 10, border: `1.5px solid ${INK}26`, background: "transparent", color: INK, fontSize: 13.5, fontWeight: 600 };

// ---- CSV import ----

function parseCSVRows(text) {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);
  return lines.map((line) => {
    const cells = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cells.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  });
}

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function parseImportCSV(text, categories) {
  const rows = parseCSVRows(text).filter((r) => r.some((c) => c.trim()));
  const dataRows = rows.slice(1); // skip header
  const otrosCat = categories.find((c) => c.id === "otros") || categories[categories.length - 1];
  const valid = [];
  const rejected = [];

  dataRows.forEach((cells, idx) => {
    const rowNum = idx + 2;
    const [dateStr = "", tipoStr = "", catStr = "", descStr = "", montoStr = ""] = cells.map((c) => c.trim());

    if (!isValidDate(dateStr)) {
      rejected.push({ row: rowNum, reason: `Fecha inválida: "${dateStr}"` });
      return;
    }
    const typeMap = { ingreso: "income", gasto: "expense" };
    const type = typeMap[tipoStr.toLowerCase()];
    if (!type) {
      rejected.push({ row: rowNum, reason: `Tipo inválido: "${tipoStr}" (debe ser "Ingreso" o "Gasto")` });
      return;
    }
    const amount = parseFloat(montoStr);
    if (isNaN(amount) || amount <= 0) {
      rejected.push({ row: rowNum, reason: `Monto inválido: "${montoStr}"` });
      return;
    }
    const found = categories.find((c) => c.name.toLowerCase() === catStr.toLowerCase());
    const category = found ? found.id : otrosCat.id;
    valid.push({ date: dateStr, type, amount, description: descStr, category, fallback: !found });
  });

  return { valid, rejected, fallbackCount: valid.filter((r) => r.fallback).length };
}

function CSVPreviewModal({ preview, onCancel, onConfirm }) {
  const { valid, rejected, fallbackCount } = preview;
  return (
    <Overlay onClose={onCancel} title="Vista previa — Importar CSV">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: `${GREEN}14`, borderRadius: 10, color: GREEN, fontWeight: 600, fontSize: 13.5 }}>
          <CheckCircle size={16} />
          {valid.length} movimiento{valid.length !== 1 ? "s" : ""} válido{valid.length !== 1 ? "s" : ""}
          {fallbackCount > 0 && (
            <span style={{ fontWeight: 400, opacity: 0.85 }}>
              &nbsp;({fallbackCount} se asignarán a "Otros" por categoría no reconocida)
            </span>
          )}
        </div>

        {rejected.length > 0 && (
          <div style={{ padding: "10px 12px", background: `${RED}10`, borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: RED, fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>
              <AlertCircle size={16} />
              {rejected.length} fila{rejected.length !== 1 ? "s" : ""} rechazada{rejected.length !== 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {rejected.map((r) => (
                <div key={r.row} style={{ fontSize: 12.5, color: RED, opacity: 0.85 }}>
                  Fila {r.row}: {r.reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Cancelar</button>
        <button
          onClick={onConfirm}
          disabled={valid.length === 0}
          style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: valid.length === 0 ? 0.4 : 1 }}
        >
          Importar {valid.length} movimiento{valid.length !== 1 ? "s" : ""}
        </button>
      </div>
    </Overlay>
  );
}
