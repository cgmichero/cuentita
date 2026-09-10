import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Pencil, X, Trash2, CreditCard, Check, Calendar, Download } from "lucide-react";
import { dbGet, dbSet } from "../db.js";
import { INK, BG, GREEN, RED, GRAY, PRIMARY } from "../constants.js";
import { fmt, fmtCompact, todayStr, uid, monthLabel, addMonths, monthsBetween, downloadCSV } from "../utils.js";
import Overlay from "../components/Overlay.jsx";
import Field from "../components/Field.jsx";
import Icon from "../components/Icon.jsx";
import CategoryManager from "../components/CategoryManager.jsx";

const currentMonthKey = () => todayStr().slice(0, 7);

function occurrences(c) {
  if (c.kind === "installment") {
    return Array.from({ length: c.installments }, (_, i) => ({
      month: addMonths(c.startMonth, i),
      amount: c.installmentAmount,
      label: `Cuota ${i + 1}/${c.installments}`,
      index: i,
    }));
  }
  return [{ month: c.dueMonth, amount: c.amount, label: "Pago único", index: 0 }];
}

export default function Module2({ categories, onCategoriesChange }) {
  const [loaded, setLoaded] = useState(false);
  const [commitments, setCommitments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [filterCard, setFilterCard] = useState("all");

  const currentMonth = currentMonthKey();

  useEffect(() => {
    (async () => {
      let commits = [];
      try {
        const m = await dbGet("commitments");
        if (m) commits = JSON.parse(m);
      } catch (e) {}
      setCommitments(commits);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    dbSet("commitments", JSON.stringify(commitments)).catch(() => {});
  }, [commitments, loaded]);

  const findCat = (id) => categories.find((c) => c.id === id);
  const catName = (id) => findCat(id)?.name || "Sin categoría";
  const catColor = (id) => findCat(id)?.color || GRAY;
  const catIcon = (id) => findCat(id)?.icon || "Package";

  const cardNames = Array.from(new Set(commitments.map((c) => c.card).filter(Boolean)));

  const allOccurrences = commitments.flatMap((c) =>
    occurrences(c).map((o) => ({
      ...o,
      commitmentId: c.id,
      description: c.description,
      category: c.category,
      card: c.card,
      loaded: (c.loadedMonths || []).includes(o.month),
      isPast: monthsBetween(o.month, currentMonth) >= 0,
    }))
  );

  const visibleOccurrences = allOccurrences.filter((o) => filterCard === "all" || o.card === filterCard);
  const futureOccurrences = visibleOccurrences.filter((o) => !o.loaded);

  const nextMonthKey = addMonths(currentMonth, 1);
  const nextMonthTotal = futureOccurrences.filter((o) => o.month === nextMonthKey).reduce((s, o) => s + o.amount, 0);

  const nextMonthsKeys = Array.from({ length: 6 }, (_, i) => addMonths(currentMonth, i));
  const barData = nextMonthsKeys.map((mk) => ({
    month: monthLabel(mk),
    Comprometido: futureOccurrences.filter((o) => o.month === mk).reduce((s, o) => s + o.amount, 0),
  }));
  const next6Total = barData.reduce((s, d) => s + d.Comprometido, 0);

  const toggleLoaded = (commitmentId, month) => {
    setCommitments((prev) =>
      prev.map((c) => {
        if (c.id !== commitmentId) return c;
        const set = new Set(c.loadedMonths || []);
        set.has(month) ? set.delete(month) : set.add(month);
        return { ...c, loadedMonths: Array.from(set) };
      })
    );
  };

  const saveNew = (data) => {
    setCommitments((prev) => [...prev, { id: uid(), loadedMonths: [], ...data }]);
    setShowForm(false);
  };

  const saveEdit = (data) => {
    setCommitments((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...data } : c)));
    setEditing(null);
  };

  const deleteCommitment = (id) => setCommitments((prev) => prev.filter((c) => c.id !== id));

  const exportCSV = () => {
    const rows = [
      ["Descripción", "Categoría", "Tarjeta", "Mes", "Monto", "Estado"],
      ...allOccurrences
        .sort((a, b) => (a.month < b.month ? -1 : 1))
        .map((o) => [o.description, catName(o.category), o.card || "", o.month, o.amount, o.loaded ? "Cargado" : o.isPast ? "Pendiente de cargar" : "Futuro"]),
    ];
    downloadCSV("gastos_futuros.csv", rows);
  };

  const visibleCommitments = commitments.filter((c) => filterCard === "all" || c.card === filterCard);

  if (!loaded) return <div style={{ padding: 40, color: INK }}>Cargando…</div>;

  return (
    <div style={{ background: BG, minHeight: "100%", color: INK, padding: "20px 16px 60px" }}>
      <header style={{ maxWidth: 640, margin: "0 auto 20px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Gastos futuros</h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, opacity: 0.55 }}>Cuotas y pagos programados</p>
      </header>

      <section style={{ maxWidth: 640, margin: "0 auto 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatBox label="Mes que viene" value={nextMonthTotal} bg={nextMonthTotal > 0 ? RED : GRAY} icon={<Calendar size={16} />} />
        <StatBox label="Próximos 6 meses" value={next6Total} bg={PRIMARY} icon={<CreditCard size={16} />} />
      </section>

      <section style={{ maxWidth: 640, margin: "0 auto 24px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>Comprometido por mes</h2>
        {barData.some((d) => d.Comprometido > 0) ? (
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="2 4" stroke={`${INK}18`} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: INK }} axisLine={{ stroke: `${INK}33` }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} width={40} tickFormatter={fmtCompact} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${INK}22` }} />
                <Bar dataKey="Comprometido" fill={RED} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5, fontSize: 13.5 }}>
            No hay compromisos cargados todavía.
          </div>
        )}
      </section>

      <section style={{ maxWidth: 640, margin: "0 auto 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setShowForm(true)} style={btnPrimary}><Plus size={15} /> Nuevo compromiso</button>
        <button onClick={() => setShowCatManager(true)} style={btnGhost}>Categorías</button>
        <button onClick={exportCSV} style={btnGhost} title="Exportar a CSV"><Download size={14} /> CSV</button>
        {cardNames.length > 0 && (
          <select value={filterCard} onChange={(e) => setFilterCard(e.target.value)} style={selectStyle}>
            <option value="all">Toda tarjeta</option>
            {cardNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </section>

      <section style={{ maxWidth: 640, margin: "0 auto" }}>
        {visibleCommitments.length === 0 && (
          <p style={{ opacity: 0.55, fontSize: 14, padding: "20px 0" }}>No hay compromisos futuros. Agregá el primero.</p>
        )}
        {visibleCommitments.map((c) => {
          const occs = occurrences(c);
          const loadedSet = new Set(c.loadedMonths || []);
          const remaining = occs.filter((o) => !loadedSet.has(o.month));
          const pending = occs.filter((o) => monthsBetween(o.month, currentMonth) >= 0 && !loadedSet.has(o.month));
          return (
            <div key={c.id} style={{ borderBottom: `1px solid ${INK}12`, padding: "14px 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: catColor(c.category), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={catIcon(c.category)} size={17} color="#fff" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{c.description}</div>
                  <div style={{ fontSize: 12, opacity: 0.55 }}>
                    {catName(c.category)}{c.card ? ` · ${c.card}` : ""} ·{" "}
                    {c.kind === "installment"
                      ? `${occs.length - remaining.length}/${occs.length} cuotas cargadas`
                      : loadedSet.size ? "Cargado" : `Vence ${monthLabel(c.dueMonth)}`}
                  </div>
                </div>
                <div className="num" style={{ fontSize: 15, fontWeight: 700, color: RED, whiteSpace: "nowrap" }}>
                  {fmt(c.kind === "installment" ? c.installmentAmount : c.amount)}
                </div>
                <button onClick={() => setEditing(c)} style={iconBtn}><Pencil size={15} /></button>
                <button onClick={() => deleteCommitment(c.id)} style={iconBtn}><Trash2 size={15} /></button>
              </div>

              {pending.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {pending.map((o) => (
                    <button
                      key={o.month}
                      onClick={() => toggleLoaded(c.id, o.month)}
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, border: `1.5px solid ${RED}55`, background: `${RED}12`, color: RED, borderRadius: 999, padding: "4px 10px" }}
                      title="Marcar como cargado en el Módulo 1"
                    >
                      <Check size={11} /> {monthLabel(o.month)} · {fmtCompact(o.amount)} — marcar cargado
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {showForm && (
        <CommitmentModal title="Nuevo compromiso" categories={categories} cardNames={cardNames} onCancel={() => setShowForm(false)} onSave={saveNew} />
      )}
      {editing && (
        <CommitmentModal title="Editar compromiso" categories={categories} cardNames={cardNames} initial={editing} onCancel={() => setEditing(null)} onSave={saveEdit} />
      )}
      {showCatManager && (
        <CategoryManager categories={categories} onClose={() => setShowCatManager(false)} onChange={onCategoriesChange} />
      )}
    </div>
  );
}

function StatBox({ label, value, bg, icon }) {
  return (
    <div style={{ background: bg, borderRadius: 16, padding: "14px 12px", color: "#fff" }}>
      <div style={{ fontSize: 11.5, opacity: 0.85, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>{icon}{label}</div>
      <div className="num" style={{ fontSize: 19, marginTop: 6, fontWeight: 800, lineHeight: 1.1 }}>{fmtCompact(value)}</div>
      <div className="num" style={{ fontSize: 10.5, opacity: 0.75, marginTop: 2 }}>{fmt(value)}</div>
    </div>
  );
}

function CommitmentModal({ title, categories, cardNames, initial, onCancel, onSave }) {
  const [kind, setKind] = useState(initial?.kind || "installment");
  const [description, setDescription] = useState(initial?.description || "");
  const [category, setCategory] = useState(initial?.category || categories[0]?.id);
  const [card, setCard] = useState(initial?.card || "");
  const [installmentAmount, setInstallmentAmount] = useState(initial?.installmentAmount ?? "");
  const [installments, setInstallments] = useState(initial?.installments ?? 2);
  const [startMonth, setStartMonth] = useState(initial?.startMonth || currentMonthKey());
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [dueMonth, setDueMonth] = useState(initial?.dueMonth || currentMonthKey());

  const totalWithInstallments = kind === "installment" && installmentAmount && installments ? Number(installmentAmount) * Number(installments) : 0;

  const canSave =
    description.trim() && category &&
    (kind === "installment"
      ? Number(installmentAmount) > 0 && Number(installments) > 0 && startMonth
      : Number(amount) > 0 && dueMonth);

  const handleSave = () => {
    if (kind === "installment") {
      onSave({ kind, description, category, card, installmentAmount: Number(installmentAmount), installments: Number(installments), startMonth });
    } else {
      onSave({ kind, description, category, card, amount: Number(amount), dueMonth });
    }
  };

  return (
    <Overlay onClose={onCancel} title={title}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["installment", "oneoff"].map((k) => (
          <button key={k} onClick={() => setKind(k)} style={{ ...toggleBtn, ...(kind === k ? { background: PRIMARY, color: "#fff", borderColor: PRIMARY } : {}) }}>
            {k === "installment" ? "Cuotas" : "Pago puntual"}
          </button>
        ))}
      </div>
      <Field label="Descripción">
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} placeholder="Ej: Heladera" />
      </Field>
      <Field label="Categoría">
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Tarjeta / medio de pago">
        <input value={card} onChange={(e) => setCard(e.target.value)} style={inputStyle} placeholder="Ej: Visa Banco X" list="card-suggestions" />
        <datalist id="card-suggestions">{cardNames.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>

      {kind === "installment" ? (
        <>
          <Field label="Monto de la cuota">
            <input className="num" type="number" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
          </Field>
          <Field label="Cantidad de cuotas">
            <input className="num" type="number" min="1" value={installments} onChange={(e) => setInstallments(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Mes de la primera cuota">
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={inputStyle} />
          </Field>
          {totalWithInstallments > 0 && (
            <p style={{ fontSize: 12.5, opacity: 0.65, marginTop: -4 }} className="num">
              Total con estas cuotas: {fmt(totalWithInstallments)}
            </p>
          )}
        </>
      ) : (
        <>
          <Field label="Monto">
            <input className="num" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
          </Field>
          <Field label="Mes de vencimiento">
            <input type="month" value={dueMonth} onChange={(e) => setDueMonth(e.target.value)} style={inputStyle} />
          </Field>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Cancelar</button>
        <button disabled={!canSave} onClick={handleSave} style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: canSave ? 1 : 0.4 }}>Guardar</button>
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
