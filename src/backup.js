import { dbGet, dbSetAll } from "./db.js";
import { DEFAULT_CATEGORIES } from "./constants.js";

export const SCHEMA_VERSION = 1;

export async function exportBackup() {
  const [movRaw, catRaw, comRaw, grpRaw] = await Promise.all([
    dbGet("movements"),
    dbGet("categories"),
    dbGet("commitments"),
    dbGet("splitGroups"),
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      movements: movRaw ? JSON.parse(movRaw) : [],
      categories: catRaw ? JSON.parse(catRaw) : DEFAULT_CATEGORIES,
      commitments: comRaw ? JSON.parse(comRaw) : [],
      splitGroups: grpRaw ? JSON.parse(grpRaw) : [],
    },
  };
}

export async function importBackup(backup) {
  if (!backup || typeof backup.schemaVersion !== "number" || !backup.data) {
    throw new Error("Formato de backup inválido.");
  }
  let { data } = backup;
  // Future: if (backup.schemaVersion < 2) data = migrateV1toV2(data);
  await dbSetAll({
    movements: JSON.stringify(data.movements ?? []),
    categories: JSON.stringify(data.categories ?? DEFAULT_CATEGORIES),
    commitments: JSON.stringify(data.commitments ?? []),
    splitGroups: JSON.stringify(data.splitGroups ?? []),
  });
}

export function downloadBackupJSON(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cuentita-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
