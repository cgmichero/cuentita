import { useState, useEffect } from "react";
import { Plus, Pencil, X, Trash2, Download, Copy, Check, ArrowRight, Archive, ArchiveRestore, UserPlus, MoreVertical } from "lucide-react";
import { dbGet, dbSet } from "../db.js";
import { INK, BG, GREEN, RED, GRAY, PRIMARY } from "../constants.js";
import { fmt, todayStr, uid, initials, downloadCSV } from "../utils.js";
import Overlay from "../components/Overlay.jsx";
import Field from "../components/Field.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

const AVATAR_COLORS = [
  "#E11D48", "#FF7A45", "#F5A623", "#EAB308", "#65A30D", "#17C3B2",
  "#06B6D4", "#1D4ED8", "#4F46E5", "#7C4DFF", "#A855F7", "#D946EF",
  "#EC4899", "#92400E", "#64748B",
];

const avatarColor = (id, people) => AVATAR_COLORS[people.findIndex((p) => p.id === id) % AVATAR_COLORS.length];

function simplifyDebts(balances) {
  const creditors = balances.filter((b) => b.net > 0.01).map((b) => ({ ...b })).sort((a, b) => b.net - a.net);
  const debtors = balances.filter((b) => b.net < -0.01).map((b) => ({ ...b })).sort((a, b) => a.net - b.net);
  const transactions = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i], creditor = creditors[j];
    const amount = Math.min(-debtor.net, creditor.net);
    if (amount > 0.01) transactions.push({ fromId: debtor.id, toId: creditor.id, amount });
    debtor.net += amount;
    creditor.net -= amount;
    if (Math.abs(debtor.net) < 0.01) i++;
    if (Math.abs(creditor.net) < 0.01) j++;
  }
  return transactions;
}

function computeBalances(group) {
  const raw = group.people.map((p) => {
    const paid = group.expenses.filter((e) => e.paidBy === p.id).reduce((s, e) => s + e.amount, 0);
    const owed = group.expenses.filter((e) => e.participants.includes(p.id)).reduce((s, e) => s + e.amount / e.participants.length, 0);
    return { id: p.id, name: p.name, paid, owed, net: paid - owed };
  });
  const settlements = group.settlements || [];
  return raw.map((b) => {
    const paidOut = settlements.filter((s) => s.fromId === b.id).reduce((s, x) => s + x.amount, 0);
    const received = settlements.filter((s) => s.toId === b.id).reduce((s, x) => s + x.amount, 0);
    return { ...b, net: b.net + paidOut - received };
  });
}

export default function Module3() {
  const [loaded, setLoaded] = useState(false);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [newPersonName, setNewPersonName] = useState("");

  useEffect(() => {
    (async () => {
      let g = [];
      try {
        const r = await dbGet("splitGroups");
        if (r) g = JSON.parse(r);
      } catch (e) {}
      setGroups(g);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    dbSet("splitGroups", JSON.stringify(groups)).catch(() => {});
  }, [groups, loaded]);

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const openGroups = groups.filter((g) => !g.closed);
  const closedGroups = groups.filter((g) => g.closed);

  const updateGroup = (id, fn) => setGroups((prev) => prev.map((g) => (g.id === id ? fn(g) : g)));

  const createGroup = (name) => {
    const g = { id: uid(), name, closed: false, people: [], expenses: [], settlements: [] };
    setGroups((prev) => [...prev, g]);
    setActiveGroupId(g.id);
    setShowNewGroup(false);
  };

  const addPerson = () => {
    if (!newPersonName.trim()) return;
    updateGroup(activeGroupId, (g) => ({ ...g, people: [...g.people, { id: uid(), name: newPersonName.trim() }] }));
    setNewPersonName("");
  };
  const removePerson = (personId) => updateGroup(activeGroupId, (g) => ({ ...g, people: g.people.filter((p) => p.id !== personId) }));

  const saveNewExpense = (data) => {
    updateGroup(activeGroupId, (g) => ({ ...g, expenses: [...g.expenses, { id: uid(), ...data }] }));
    setShowExpenseForm(false);
  };
  const saveEditExpense = (data) => {
    updateGroup(activeGroupId, (g) => ({ ...g, expenses: g.expenses.map((e) => (e.id === editingExpense.id ? { ...e, ...data } : e)) }));
    setEditingExpense(null);
  };
  const deleteExpense = (expenseId) => updateGroup(activeGroupId, (g) => ({ ...g, expenses: g.expenses.filter((e) => e.id !== expenseId) }));

  const settleTransaction = (t) => {
    updateGroup(activeGroupId, (g) => ({
      ...g,
      settlements: [...(g.settlements || []), { id: uid(), fromId: t.fromId, toId: t.toId, amount: t.amount, date: todayStr() }],
    }));
  };
  const unsettle = (settlementId) => updateGroup(activeGroupId, (g) => ({ ...g, settlements: (g.settlements || []).filter((s) => s.id !== settlementId) }));

  const toggleClosed = (id) => updateGroup(id, (g) => ({ ...g, closed: !g.closed }));
  const deleteGroup = (id) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (activeGroupId === id) setActiveGroupId(null);
  };
  const cloneGroup = (id) => {
    const source = groups.find((g) => g.id === id);
    if (!source) return;
    setGroups((prev) => [...prev, { id: uid(), name: source.name, closed: false, people: source.people.map((p) => ({ id: uid(), name: p.name })), expenses: [], settlements: [] }]);
  };
  const renameGroup = (id, newName) => { updateGroup(id, (g) => ({ ...g, name: newName })); setRenamingGroup(null); };

  const exportCSV = () => {
    const rows = [
      ["Fecha", "Descripción", "Monto", "Pagó", "Participantes"],
      ...activeGroup.expenses.map((e) => [
        e.date, e.description, e.amount,
        activeGroup.people.find((p) => p.id === e.paidBy)?.name || "",
        e.participants.map((pid) => activeGroup.people.find((p) => p.id === pid)?.name).filter(Boolean).join(" / "),
      ]),
    ];
    downloadCSV(`${activeGroup.name.replace(/\s+/g, "_")}.csv`, rows);
  };

  if (!loaded) return <div style={{ padding: 40, color: INK }}>Cargando…</div>;

  return (
    <div style={{ background: BG, minHeight: "100%", color: INK, padding: "20px 16px 60px" }}>
      {!activeGroup ? (
        <GroupList
          openGroups={openGroups}
          closedGroups={closedGroups}
          onOpen={setActiveGroupId}
          onNew={() => setShowNewGroup(true)}
          onToggleClosed={toggleClosed}
          onDelete={deleteGroup}
          onClone={cloneGroup}
          onRename={setRenamingGroup}
        />
      ) : (
        <GroupDetail
          group={activeGroup}
          onBack={() => setActiveGroupId(null)}
          newPersonName={newPersonName}
          setNewPersonName={setNewPersonName}
          addPerson={addPerson}
          removePerson={removePerson}
          onNewExpense={() => setShowExpenseForm(true)}
          onEditExpense={setEditingExpense}
          onDeleteExpense={deleteExpense}
          onToggleClosed={() => toggleClosed(activeGroup.id)}
          onExportCSV={exportCSV}
          onSettle={settleTransaction}
          onUnsettle={unsettle}
          onRename={() => setRenamingGroup(activeGroup.id)}
        />
      )}

      {showNewGroup && <NewGroupModal onCancel={() => setShowNewGroup(false)} onCreate={createGroup} />}
      {showExpenseForm && (
        <ExpenseModal title="Nuevo gasto" people={activeGroup.people} onCancel={() => setShowExpenseForm(false)} onSave={saveNewExpense} />
      )}
      {editingExpense && (
        <ExpenseModal title="Editar gasto" people={activeGroup.people} initial={editingExpense} onCancel={() => setEditingExpense(null)} onSave={saveEditExpense} />
      )}
      {renamingGroup && (
        <RenameGroupModal
          initialName={groups.find((g) => g.id === renamingGroup)?.name || ""}
          onCancel={() => setRenamingGroup(null)}
          onSave={(name) => renameGroup(renamingGroup, name)}
        />
      )}
    </div>
  );
}

function GroupList({ openGroups, closedGroups, onOpen, onNew, onToggleClosed, onDelete, onClone, onRename }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }} onClick={() => setMenuOpenId(null)}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>División de gastos</h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, opacity: 0.55 }}>Grupos por viaje o evento</p>
      </header>
      <button onClick={onNew} style={{ ...btnPrimary, marginBottom: 20 }}><Plus size={15} /> Nuevo grupo</button>
      {openGroups.length === 0 && closedGroups.length === 0 && (
        <p style={{ opacity: 0.55, fontSize: 14 }}>No tenés grupos todavía. Creá el primero.</p>
      )}
      {openGroups.map((g) => (
        <GroupRow key={g.id} g={g} onOpen={onOpen} onToggleClosed={onToggleClosed} onDelete={onDelete} onClone={onClone} onRename={onRename} menuOpen={menuOpenId === g.id} setMenuOpen={(v) => setMenuOpenId(v ? g.id : null)} />
      ))}
      {closedGroups.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 700, opacity: 0.5, margin: "20px 0 8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>Cerrados</h2>
          {closedGroups.map((g) => (
            <GroupRow key={g.id} g={g} onOpen={onOpen} onToggleClosed={onToggleClosed} onDelete={onDelete} onClone={onClone} onRename={onRename} menuOpen={menuOpenId === g.id} setMenuOpen={(v) => setMenuOpenId(v ? g.id : null)} />
          ))}
        </>
      )}
    </div>
  );
}

function GroupRow({ g, onOpen, onToggleClosed, onDelete, onClone, onRename, menuOpen, setMenuOpen }) {
  const total = g.expenses.reduce((s, e) => s + e.amount, 0);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "12px 4px", borderBottom: `1px solid ${INK}12`, opacity: g.closed ? 0.6 : 1 }}>
      <button onClick={() => onOpen(g.id)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</div>
        <div style={{ fontSize: 12, opacity: 0.55 }}>{g.people.length} personas · {g.expenses.length} gastos</div>
      </button>
      <div className="num" style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(total)}</div>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} style={iconBtn} title="Más opciones"><MoreVertical size={16} /></button>
      {menuOpen && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "100%", right: 0, background: "#fff", borderRadius: 10, border: `1px solid ${INK}18`, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 10, minWidth: 150, overflow: "hidden" }}>
          <MenuItem icon={<Pencil size={14} />} label="Editar nombre" onClick={() => { onRename(g.id); setMenuOpen(false); }} />
          <MenuItem icon={<Copy size={14} />} label="Clonar" onClick={() => { onClone(g.id); setMenuOpen(false); }} />
          <MenuItem icon={g.closed ? <ArchiveRestore size={14} /> : <Archive size={14} />} label={g.closed ? "Reabrir" : "Cerrar"} onClick={() => { onToggleClosed(g.id); setMenuOpen(false); }} />
          <MenuItem icon={<Trash2 size={14} />} label="Eliminar" danger onClick={() => { onDelete(g.id); setMenuOpen(false); }} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", fontSize: 13.5, fontWeight: 600, color: danger ? RED : INK, textAlign: "left" }}>
      {icon} {label}
    </button>
  );
}

function GroupDetail({ group, onBack, newPersonName, setNewPersonName, addPerson, removePerson, onNewExpense, onEditExpense, onDeleteExpense, onToggleClosed, onExportCSV, onSettle, onUnsettle, onRename }) {
  const balances = computeBalances(group);
  const transactions = simplifyDebts(balances);
  const settlements = group.settlements || [];
  const findPerson = (id) => group.people.find((p) => p.id === id);
  const total = group.expenses.reduce((s, e) => s + e.amount, 0);
  const [confirmAction, setConfirmAction] = useState(null);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <button onClick={onBack} style={{ ...btnGhost, marginBottom: 16 }}>← Grupos</button>
      <header style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            {group.name}
            <button onClick={onRename} style={{ ...iconBtn, opacity: 0.5 }} title="Editar nombre"><Pencil size={16} /></button>
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.55 }} className="num">Total del grupo: {fmt(total)}</p>
        </div>
        <button onClick={onToggleClosed} style={btnGhost}>{group.closed ? "Reabrir" : "Cerrar grupo"}</button>
      </header>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Personas</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {group.people.map((p) => (
            <span key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1.5px solid ${INK}20`, borderRadius: 999, padding: "5px 6px 5px 5px" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: avatarColor(p.id, group.people), color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {initials(p.name)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
              <button onClick={() => removePerson(p.id)} style={{ background: "none", border: "none", padding: 0, opacity: 0.5, display: "flex" }}><X size={13} /></button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} placeholder="Nombre de la persona" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addPerson} style={btnPrimary}><UserPlus size={15} /></button>
        </div>
      </section>

      {group.people.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Balance por persona</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {balances.map((b) => (
              <div key={b.id} style={{ background: b.net > 0.01 ? GREEN : b.net < -0.01 ? RED : GRAY, borderRadius: 16, padding: "12px 12px", color: "#fff" }}>
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700 }}>{b.name}</div>
                <div className="num" style={{ fontSize: 17, marginTop: 4, fontWeight: 800, lineHeight: 1.1 }}>
                  {b.net > 0 ? "+" : ""}{fmt(b.net)}
                </div>
                <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 2 }}>
                  {b.net > 0.01 ? "le deben" : b.net < -0.01 ? "debe" : "está saldado"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {transactions.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Para saldar cuentas</h2>
          {transactions.map((t, i) => (
            <button
              key={i}
              onClick={() => setConfirmAction({ type: "settle", data: t })}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#fff", borderRadius: 12, marginBottom: 6, border: `1px solid ${INK}12`, width: "100%", textAlign: "left" }}
            >
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{findPerson(t.fromId)?.name}</span>
              <ArrowRight size={14} color={GRAY} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{findPerson(t.toId)?.name}</span>
              <span className="num" style={{ marginLeft: "auto", fontWeight: 700, color: PRIMARY, fontSize: 14 }}>{fmt(t.amount)}</span>
            </button>
          ))}
        </section>
      )}

      {settlements.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Saldado</h2>
          {settlements.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: `${GREEN}10`, borderRadius: 12, marginBottom: 6, border: `1px solid ${GREEN}33` }}>
              <Check size={14} color={GREEN} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{findPerson(s.fromId)?.name}</span>
              <ArrowRight size={14} color={GRAY} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{findPerson(s.toId)?.name}</span>
              <span className="num" style={{ fontWeight: 700, color: GREEN, fontSize: 14 }}>{fmt(s.amount)}</span>
              <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 4 }}>{s.date}</span>
              <button onClick={() => setConfirmAction({ type: "unsettle", data: s })} style={{ ...iconBtn, marginLeft: "auto" }} title="Volver a pendiente">
                <X size={15} />
              </button>
            </div>
          ))}
        </section>
      )}

      <section style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={onNewExpense} disabled={group.people.length === 0} style={{ ...btnPrimary, opacity: group.people.length === 0 ? 0.4 : 1 }}>
          <Plus size={15} /> Nuevo gasto
        </button>
        <button onClick={onExportCSV} style={btnGhost} disabled={group.expenses.length === 0}><Download size={14} /> CSV</button>
      </section>
      {group.people.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, marginTop: -6 }}>Agregá al menos una persona para poder cargar gastos.</p>}

      <section>
        {group.expenses.length === 0 && <p style={{ opacity: 0.55, fontSize: 14, padding: "10px 0" }}>No hay gastos cargados todavía.</p>}
        {group.expenses.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px", borderBottom: `1px solid ${INK}12` }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: avatarColor(e.paidBy, group.people), color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {initials(findPerson(e.paidBy)?.name || "?")}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{e.description}</div>
              <div style={{ fontSize: 12, opacity: 0.55 }}>Pagó {findPerson(e.paidBy)?.name || "?"} · entre {e.participants.length} · {e.date}</div>
            </div>
            <div className="num" style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(e.amount)}</div>
            <button onClick={() => onEditExpense(e)} style={iconBtn}><Pencil size={15} /></button>
            <button onClick={() => onDeleteExpense(e.id)} style={iconBtn}><Trash2 size={15} /></button>
          </div>
        ))}
      </section>

      {confirmAction?.type === "settle" && (
        <ConfirmModal
          title="Marcar como saldado"
          message={`¿Confirmás que ${findPerson(confirmAction.data.fromId)?.name} le pagó ${fmt(confirmAction.data.amount)} a ${findPerson(confirmAction.data.toId)?.name}?`}
          confirmLabel="Marcar como saldado"
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => { onSettle(confirmAction.data); setConfirmAction(null); }}
        />
      )}
      {confirmAction?.type === "unsettle" && (
        <ConfirmModal
          title="Volver a pendiente"
          message={`¿Confirmás que el pago de ${findPerson(confirmAction.data.fromId)?.name} a ${findPerson(confirmAction.data.toId)?.name} por ${fmt(confirmAction.data.amount)} todavía no está saldado?`}
          confirmLabel="Volver a pendiente"
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => { onUnsettle(confirmAction.data.id); setConfirmAction(null); }}
        />
      )}
    </div>
  );
}

function NewGroupModal({ onCancel, onCreate }) {
  const [name, setName] = useState("");
  return (
    <Overlay onClose={onCancel} title="Nuevo grupo">
      <Field label="Nombre del grupo">
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Ej: Viaje a Bariloche" autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Cancelar</button>
        <button disabled={!name.trim()} onClick={() => onCreate(name.trim())} style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: name.trim() ? 1 : 0.4 }}>Crear</button>
      </div>
    </Overlay>
  );
}

function RenameGroupModal({ initialName, onCancel, onSave }) {
  const [name, setName] = useState(initialName);
  return (
    <Overlay onClose={onCancel} title="Editar nombre del grupo">
      <Field label="Nombre del grupo">
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Cancelar</button>
        <button disabled={!name.trim()} onClick={() => onSave(name.trim())} style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: name.trim() ? 1 : 0.4 }}>Guardar</button>
      </div>
    </Overlay>
  );
}

function ExpenseModal({ title, people, initial, onCancel, onSave }) {
  const [description, setDescription] = useState(initial?.description || "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [paidBy, setPaidBy] = useState(initial?.paidBy || people[0]?.id);
  const [participants, setParticipants] = useState(initial?.participants || people.map((p) => p.id));
  const [date, setDate] = useState(initial?.date || todayStr());

  const toggleParticipant = (id) => setParticipants((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const canSave = description.trim() && Number(amount) > 0 && paidBy && participants.length > 0 && date;

  return (
    <Overlay onClose={onCancel} title={title}>
      <Field label="Descripción">
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} placeholder="Ej: Cena" />
      </Field>
      <Field label="Monto">
        <input className="num" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
      </Field>
      <Field label="¿Quién pagó?">
        <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} style={inputStyle}>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Fecha">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="¿Entre quiénes se divide?">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {people.map((p) => (
            <button key={p.id} onClick={() => toggleParticipant(p.id)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: `1.5px solid ${PRIMARY}`, background: participants.includes(p.id) ? PRIMARY : "#fff", color: participants.includes(p.id) ? "#fff" : PRIMARY }}>
              {p.name}
            </button>
          ))}
        </div>
        {participants.length > 0 && Number(amount) > 0 && (
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }} className="num">
            {fmt(Number(amount) / participants.length)} por persona
          </p>
        )}
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Cancelar</button>
        <button disabled={!canSave} onClick={() => onSave({ description, amount: Number(amount), paidBy, participants, date })} style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: canSave ? 1 : 0.4 }}>Guardar</button>
      </div>
    </Overlay>
  );
}

const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, background: PRIMARY, color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 700 };
const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: INK, border: `1.5px solid ${INK}33`, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600 };
const iconBtn = { background: "none", border: "none", color: INK, opacity: 0.65, padding: 4 };
const inputStyle = { width: "100%", border: `1.5px solid ${INK}26`, borderRadius: 10, padding: "9px 10px", fontSize: 14, background: "#fff", color: INK, boxSizing: "border-box" };
