import { useState, useEffect } from "react";
import { BookOpen, CalendarClock, Users, Settings } from "lucide-react";
import { dbGet, dbSet } from "./db.js";
import { INK, BG, PRIMARY, DEFAULT_CATEGORIES } from "./constants.js";
import Module1 from "./modules/Module1.jsx";
import Module2 from "./modules/Module2.jsx";
import Module3 from "./modules/Module3.jsx";
import SettingsPage from "./pages/Settings.jsx";

const TABS = [
  { id: "gastos", label: "Gastos", Icon: BookOpen },
  { id: "futuros", label: "Futuros", Icon: CalendarClock },
  { id: "division", label: "División", Icon: Users },
  { id: "ajustes", label: "Ajustes", Icon: Settings },
];

const BACKUP_KEY = "cuentita_last_backup";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export default function App() {
  const [tab, setTab] = useState("gastos");
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [showBackupBanner, setShowBackupBanner] = useState(false);

  useEffect(() => {
    (async () => {
      let cats = DEFAULT_CATEGORIES;
      try {
        const c = await dbGet("categories");
        if (c) {
          cats = JSON.parse(c);
          // one-time migration: remove legacy "comida" category
          if (cats.some((cat) => cat.id === "comida")) {
            cats = cats.filter((cat) => cat.id !== "comida");
            if (!cats.some((cat) => cat.id === "comida_bebida")) cats.push(DEFAULT_CATEGORIES[0]);
            if (!cats.some((cat) => cat.id === "supermercado")) cats.push(DEFAULT_CATEGORIES[1]);
          }
          cats = cats.map((c) => ({ icon: "Package", ...c }));
        }
      } catch (e) {}
      setCategories(cats);
      setCatsLoaded(true);
    })();

    // backup reminder: show banner if last backup > 7 days ago
    const last = localStorage.getItem(BACKUP_KEY);
    if (!last || Date.now() - Number(last) > SEVEN_DAYS) {
      setShowBackupBanner(true);
    }
  }, []);

  useEffect(() => {
    if (!catsLoaded) return;
    dbSet("categories", JSON.stringify(categories)).catch(() => {});
  }, [categories, catsLoaded]);

  if (!catsLoaded) {
    return (
      <div style={{ background: BG, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: INK, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        Cargando…
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100dvh", fontFamily: "ui-sans-serif, system-ui, sans-serif", color: INK }}>
      {showBackupBanner && tab !== "ajustes" && (
        <div
          style={{ background: `${PRIMARY}18`, borderBottom: `1px solid ${PRIMARY}33`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13, color: PRIMARY, fontWeight: 600 }}
        >
          <span>¿Hace tiempo que no hacés backup?</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => { setTab("ajustes"); setShowBackupBanner(false); }} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12.5, fontWeight: 700 }}>
              Ir a Ajustes
            </button>
            <button onClick={() => setShowBackupBanner(false)} style={{ background: "none", border: "none", color: PRIMARY, fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
          </div>
        </div>
      )}

      <div style={{ paddingBottom: 64 }}>
        <div style={{ display: tab === "gastos" ? "block" : "none" }}>
          <Module1 categories={categories} onCategoriesChange={setCategories} />
        </div>
        <div style={{ display: tab === "futuros" ? "block" : "none" }}>
          <Module2 categories={categories} onCategoriesChange={setCategories} />
        </div>
        <div style={{ display: tab === "division" ? "block" : "none" }}>
          <Module3 />
        </div>
        <div style={{ display: tab === "ajustes" ? "block" : "none" }}>
          <SettingsPage />
        </div>
      </div>

      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#fff", borderTop: `1px solid ${INK}18`,
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 40,
      }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, padding: "10px 4px 8px", background: "none", border: "none",
              color: tab === id ? PRIMARY : `${INK}66`,
              fontSize: 10.5, fontWeight: tab === id ? 700 : 500,
            }}
          >
            <Icon size={20} strokeWidth={tab === id ? 2.5 : 1.75} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
