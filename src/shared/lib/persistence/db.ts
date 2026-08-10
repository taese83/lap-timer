// IndexedDB 영속(state-contract.md). 확정 설계엔 홈/과거세션 목록이 없으므로 **현재 세션 1개**만
// key "current"로 저장·복원한다(새로고침 시 랩 유지). 초기화 시 삭제. 마이그레이션 v1.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SessionRecord } from "@/entities/session/model/types";

interface LaptimeDB extends DBSchema {
  sessions: { key: string; value: SessionRecord };
}

const DB_NAME = "minicar-laptime";
const DB_VERSION = 1;
const CURRENT = "current";
let dbp: Promise<IDBPDatabase<LaptimeDB>> | null = null;

function db(): Promise<IDBPDatabase<LaptimeDB>> {
  if (!dbp) {
    dbp = openDB<LaptimeDB>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("sessions")) d.createObjectStore("sessions", { keyPath: "id" });
      },
    });
  }
  return dbp;
}

export async function saveCurrent(session: Omit<SessionRecord, "id">): Promise<void> {
  try {
    await (await db()).put("sessions", { ...session, id: CURRENT });
  } catch {
    // 영속 실패는 측정 자체를 막지 않는다(best-effort).
  }
}

export async function loadCurrent(): Promise<SessionRecord | null> {
  try {
    return (await (await db()).get("sessions", CURRENT)) ?? null;
  } catch {
    return null;
  }
}

export async function clearCurrent(): Promise<void> {
  try {
    await (await db()).delete("sessions", CURRENT);
  } catch {
    /* noop */
  }
}
