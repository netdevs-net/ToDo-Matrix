export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  quadrant: QuadrantType;
  createdAt: number;
  completedAt?: number;
  timeSpent: number;
  lastStartTime?: number;
  archived?: boolean;
  dueDate?: number;
  estimatedDuration?: number;
  reminder?: {
    time: number;
    type: 'email' | 'push' | 'both';
  };
  tags: string[];
  comments: Comment[];
  recurrence?: string; // RRULE string
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

export interface Comment {
  id: string;
  todoId: string;
  content: string;
  createdAt: number;
  editedAt?: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface AppSettings {
  darkMode: boolean;
  quadrantColors: Record<QuadrantType, string>;
  showArchived: boolean;
  enableSharing: boolean;
  notifications?: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  timezone?: string;
  language?: string;
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