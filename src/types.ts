export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  quadrant: QuadrantType;
  createdAt: number;
  updatedAt: number;
  /**
   * Rank within the todo's quadrant. Order used to live only in the position
   * of the array, which meant a merge could not carry it between devices --
   * each device kept whatever order it happened to have. Storing the rank per
   * todo lets it travel and be resolved like any other edited field.
   */
  position: number;
  deletedAt?: number;
  completedAt?: number;
  timeSpent: number;
  lastStartTime?: number;
  archived?: boolean;
}

export type QuadrantType = 'urgentImportant' | 'importantNotUrgent' | 'urgentNotImportant' | 'notUrgentNotImportant';

export interface QuadrantConfig {
  id: QuadrantType;
  title: string;
  description: string;
  bgColor: string;
  borderColor: string;
  customColor?: string;
}

export interface AppSettings {
  darkMode: boolean;
  quadrantColors: Record<QuadrantType, string>;
  showArchived: boolean;
}

export interface QuadrantStats {
  total: number;
  completed: number;
  timeSpent: number;
}

export interface Statistics {
  totalTasks: number;
  completedTasks: number;
  totalTimeSpent: number;
  quadrants: Record<QuadrantType, QuadrantStats>;
}

export interface BackupData {
  todos: Todo[];
  settings: AppSettings;
  quadrantConfigs: QuadrantConfig[];
  version: string;
  timestamp: number;
}

export interface SyncMeta {
  settingsUpdatedAt: number;
  quadrantConfigsUpdatedAt: number;
}

export interface SyncState {
  todos: Todo[];
  settings: AppSettings;
  quadrantConfigs: QuadrantConfig[];
  meta: SyncMeta;
}

export interface EncryptedBlob {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export type SyncPhase = 'disabled' | 'idle' | 'syncing' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  lastSyncedAt?: number;
  error?: string;
}

export interface SyncConfig {
  enabled: boolean;
  endpoint: string;
  token: string;
}
