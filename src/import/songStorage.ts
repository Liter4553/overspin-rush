// 임포트한 채보(음원/자켓 blob 포함)를 IndexedDB에 저장·조회·삭제한다.
// 스탠드얼론 포팅 후에도 그대로 쓸 수 있도록 저장 형식은 원본 .pattern 텍스트를 그대로 보관하고,
// 파싱은 읽는 쪽(선곡 화면)에서 그때그때 수행한다.
import type { Difficulty } from "../chart/songList";

const DB_NAME = "overspin-rush";
const DB_VERSION = 1;
const STORE_NAME = "importedSongs";

export interface ImportedSong {
  id: string;
  title: string;
  artist: string;
  patternTextByDifficulty: Partial<Record<Difficulty, string>>;
  audioBlob: Blob;
  jacketBlob?: Blob;
  importedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveImportedSong(song: ImportedSong): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(song);
    await promisifyTransaction(tx);
  } finally {
    db.close();
  }
}

export async function getAllImportedSongs(): Promise<ImportedSong[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const result = await promisifyRequest(tx.objectStore(STORE_NAME).getAll());
    return result as ImportedSong[];
  } finally {
    db.close();
  }
}

export async function getImportedSong(id: string): Promise<ImportedSong | undefined> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const result = await promisifyRequest(tx.objectStore(STORE_NAME).get(id));
    return result as ImportedSong | undefined;
  } finally {
    db.close();
  }
}

export async function deleteImportedSong(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await promisifyTransaction(tx);
  } finally {
    db.close();
  }
}
