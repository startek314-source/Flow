/**
 * Flow DB - IndexedDB wrapper for offline data persistence
 * Stores: notes, schedules, alarms, user profile, tags
 */

export interface UserProfile {
  id: string;
  name: string;
  notificationsEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  onboardingCompleted: boolean;
  createdAt: number;
}

export type NoteBlock =
  | { type: 'title'; text: string }
  | { type: 'subtitle'; text: string }
  | { type: 'body'; text: string; bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean; color?: string; highlight?: string }
  | { type: 'checklist'; items: { id: string; text: string; checked: boolean }[] }
  | { type: 'code'; text: string; lang?: string }
  | { type: 'quote'; text: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'divider' }
  | { type: 'callout'; text: string; emoji?: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; src: string; caption?: string }
  | { type: 'audio'; src: string; transcript?: string };

export interface Alarm {
  id: string;
  noteId: string;
  text: string;
  scheduledAt: number;
  fired: boolean;
  title: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // raw text for search
  blocks: NoteBlock[];
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  locked: boolean;
  color?: string;
  alarms: Alarm[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // soft delete
  template?: boolean;
  readOnly?: boolean;
  history: { blocks: NoteBlock[]; savedAt: number }[];
  wordCount: number;
  charCount: number;
}

export interface Schedule {
  id: string;
  title: string;
  notificationTitle?: string;
  startAt: number;
  endAt?: number;
  allDay?: boolean;
  description?: string;
  location?: string;
  url?: string;
  attendees?: string[];
  reminders?: number[]; // minutes before
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  color?: string;
  noteId?: string;
  attachments?: string[];
  status?: 'confirmed' | 'tentative' | 'cancelled';
  timezone?: string;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'flow-db';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains('userProfile')) {
        database.createObjectStore('userProfile', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('notes')) {
        const noteStore = database.createObjectStore('notes', { keyPath: 'id' });
        noteStore.createIndex('updatedAt', 'updatedAt');
        noteStore.createIndex('pinned', 'pinned');
        noteStore.createIndex('tags', 'tags', { multiEntry: true });
      }
      if (!database.objectStoreNames.contains('schedules')) {
        const scheduleStore = database.createObjectStore('schedules', { keyPath: 'id' });
        scheduleStore.createIndex('startAt', 'startAt');
      }
      if (!database.objectStoreNames.contains('alarms')) {
        const alarmStore = database.createObjectStore('alarms', { keyPath: 'id' });
        alarmStore.createIndex('scheduledAt', 'scheduledAt');
        alarmStore.createIndex('fired', 'fired');
      }
    };
    request.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function transaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function getAllFromStore<T>(storeName: string): Promise<T[]> {
  return openDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

// --- User Profile ---
export async function getProfile(): Promise<UserProfile | null> {
  const all = await getAllFromStore<UserProfile>('userProfile');
  return all[0] ?? null;
}
export function saveProfile(profile: UserProfile): Promise<IDBValidKey> {
  return transaction('userProfile', 'readwrite', (s) => s.put(profile));
}

// --- Notes ---
export function getNotes(): Promise<Note[]> {
  return getAllFromStore<Note>('notes');
}
export function saveNote(note: Note): Promise<IDBValidKey> {
  return transaction('notes', 'readwrite', (s) => s.put(note));
}
export function deleteNote(id: string): Promise<undefined> {
  return transaction<undefined>('notes', 'readwrite', (s) => s.delete(id));
}
export async function getNoteById(id: string): Promise<Note | null> {
  const result = await transaction<Note>('notes', 'readonly', (s) => s.get(id));
  return result ?? null;
}

// --- Schedules ---
export function getSchedules(): Promise<Schedule[]> {
  return getAllFromStore<Schedule>('schedules');
}
export function saveSchedule(schedule: Schedule): Promise<IDBValidKey> {
  return transaction('schedules', 'readwrite', (s) => s.put(schedule));
}
export function deleteSchedule(id: string): Promise<undefined> {
  return transaction<undefined>('schedules', 'readwrite', (s) => s.delete(id));
}

// --- Alarms ---
export function getAlarms(): Promise<Alarm[]> {
  return getAllFromStore<Alarm>('alarms');
}
export function saveAlarm(alarm: Alarm): Promise<IDBValidKey> {
  return transaction('alarms', 'readwrite', (s) => s.put(alarm));
}
export function deleteAlarm(id: string): Promise<undefined> {
  return transaction<undefined>('alarms', 'readwrite', (s) => s.delete(id));
}

// --- Utilities ---
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createNote(overrides: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: generateId(),
    title: '',
    content: '',
    blocks: [{ type: 'body', text: '' }],
    tags: [],
    pinned: false,
    favorite: false,
    locked: false,
    alarms: [],
    createdAt: now,
    updatedAt: now,
    history: [],
    wordCount: 0,
    charCount: 0,
    ...overrides,
  };
}

export function createSchedule(overrides: Partial<Schedule> = {}): Schedule {
  const now = Date.now();
  return {
    id: generateId(),
    title: '',
    startAt: now,
    category: 'personal',
    priority: 'medium',
    color: '#3b82f6',
    repeat: 'none',
    status: 'confirmed',
    reminders: [10],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
