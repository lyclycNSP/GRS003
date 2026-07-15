import { parseCalibratorDraft, serializeCalibratorDraft, type CalibratorDraft } from "./draft-types";

const DB_NAME = "ary-track-calibrator";
const DB_VERSION = 1;
const STORES = ["drafts", "backgrounds", "validationReports", "metadata"] as const;

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error("IndexedDB request failed"));
  });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function open(factory: IDBFactory, dbName: string): Promise<IDBDatabase> {
  const operation = factory.open(dbName, DB_VERSION);
  operation.onupgradeneeded = () => {
    for (const name of STORES) if (!operation.result.objectStoreNames.contains(name)) operation.result.createObjectStore(name);
  };
  return request(operation);
}

export interface CalibratorDraftRepository {
  getDraft(draftId: string): Promise<CalibratorDraft | null>;
  saveDraft(draft: CalibratorDraft, background?: Blob): Promise<void>;
  getBackground(assetId: string): Promise<Blob | null>;
  deleteDraft(draftId: string): Promise<void>;
  exportDraftBundle(draftId: string): Promise<Blob>;
}

export function createCalibratorDraftRepository(options?: { indexedDb?: IDBFactory; dbName?: string }): CalibratorDraftRepository {
  const factory = options?.indexedDb ?? globalThis.indexedDB;
  if (!factory) throw new Error("IndexedDB is not available");
  const database = open(factory, options?.dbName ?? DB_NAME);

  return {
    async getDraft(draftId) {
      const db = await database;
      const tx = db.transaction("drafts", "readonly");
      const stored = await request(tx.objectStore("drafts").get(draftId)) as string | undefined;
      await completed(tx);
      return stored ? parseCalibratorDraft(stored) : null;
    },
    async saveDraft(draft, background) {
      const normalized = parseCalibratorDraft(draft);
      const db = await database;
      const stores = background ? ["drafts", "backgrounds", "validationReports", "metadata"] : ["drafts", "validationReports", "metadata"];
      const tx = db.transaction(stores, "readwrite");
      tx.objectStore("drafts").put(serializeCalibratorDraft(normalized), normalized.draftId);
      if (background) tx.objectStore("backgrounds").put(background, normalized.backgroundAssetId);
      if (normalized.validationReport) tx.objectStore("validationReports").put(normalized.validationReport, normalized.draftId);
      else tx.objectStore("validationReports").delete(normalized.draftId);
      tx.objectStore("metadata").put(normalized.draftId, "currentDraftId");
      await completed(tx);
    },
    async getBackground(assetId) {
      const db = await database;
      const tx = db.transaction("backgrounds", "readonly");
      const blob = await request(tx.objectStore("backgrounds").get(assetId)) as Blob | undefined;
      await completed(tx);
      return blob ?? null;
    },
    async deleteDraft(draftId) {
      const db = await database;
      const tx = db.transaction(["drafts", "backgrounds", "validationReports", "metadata"], "readwrite");
      tx.objectStore("drafts").delete(draftId);
      tx.objectStore("validationReports").delete(draftId);
      tx.objectStore("metadata").delete("currentDraftId");
      await completed(tx);
    },
    async exportDraftBundle(draftId) {
      const draft = await this.getDraft(draftId);
      if (!draft) throw new Error("Draft not found");
      const background = await this.getBackground(draft.backgroundAssetId);
      let backgroundBase64: string | null = null;
      if (background) {
        const bytes = new Uint8Array(await background.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
        backgroundBase64 = btoa(binary);
      }
      return new Blob([JSON.stringify({ format: "ary-track-calibrator-draft", version: 1, draft, background: background ? { mimeType: background.type, size: background.size, base64: backgroundBase64 } : null }, null, 2)], { type: "application/json" });
    }
  };
}
