import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';
import { Todo, QuadrantType, QuadrantConfig, AppSettings, Statistics as StatsType, BackupData, SyncMeta, SyncState } from './types';
import { purgeTombstones, visibleTodos } from './sync/merge';
import { useSync } from './sync/useSync';
import TodoList from './components/TodoList';
import Statistics from './components/Statistics';
import Header from './components/Header';

const defaultQuadrantConfigs: QuadrantConfig[] = [
  {
    id: 'urgentImportant',
    title: 'Urgent & Important',
    description: 'Do these tasks immediately',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  {
    id: 'importantNotUrgent',
    title: 'Important, Not Urgent',
    description: 'Schedule time for these tasks',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'urgentNotImportant',
    title: 'Urgent, Not Important',
    description: 'Delegate these tasks if possible',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  {
    id: 'notUrgentNotImportant',
    title: 'Not Urgent, Not Important',
    description: 'Eliminate these tasks if possible',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
];

const STORAGE_KEY = 'todo-matrix-todos';
const SETTINGS_KEY = 'todo-matrix-settings';
const QUADRANT_CONFIG_KEY = 'todo-matrix-quadrant-config';
const META_KEY = 'todo-matrix-sync-meta';

const defaultSettings: AppSettings = {
  darkMode: true,
  quadrantColors: {
    urgentImportant: '',
    importantNotUrgent: '',
    urgentNotImportant: '',
    notUrgentNotImportant: '',
  },
  showArchived: false,
  enableSharing: false,
};

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [, setActiveId] = useState<string | null>(null);
  const [quadrantConfigs, setQuadrantConfigs] = useState<QuadrantConfig[]>(defaultQuadrantConfigs);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [showStats, setShowStats] = useState(false);
  const [meta, setMeta] = useState<SyncMeta>({ settingsUpdatedAt: 0, quadrantConfigsUpdatedAt: 0 });
  const [loaded, setLoaded] = useState(false);
  const [timeTrackingInterval, setTimeTrackingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedTodos = localStorage.getItem(STORAGE_KEY);
    if (savedTodos) {
      try {
        const parsedTodos = JSON.parse(savedTodos);
        const updatedTodos = parsedTodos.map((todo: any) => ({
          ...todo,
          createdAt: todo.createdAt || Date.now(),
          // Pre-sync todos have no updatedAt; treat their creation as the last edit.
          updatedAt: todo.updatedAt || todo.createdAt || Date.now(),
          timeSpent: todo.timeSpent || 0,
          lastStartTime: todo.lastStartTime || undefined,
          archived: todo.archived || false,
        }));
        setTodos(purgeTombstones(updatedTodos));
      } catch (error) {
        console.error('Failed to parse saved todos:', error);
      }
    }

    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    } else {
      document.documentElement.classList.add('dark');
    }

    const savedQuadrantConfigs = localStorage.getItem(QUADRANT_CONFIG_KEY);
    if (savedQuadrantConfigs) {
      try {
        setQuadrantConfigs(JSON.parse(savedQuadrantConfigs));
      } catch (error) {
        console.error('Failed to parse saved quadrant configs:', error);
      }
    }

    const savedMeta = localStorage.getItem(META_KEY);
    if (savedMeta) {
      try {
        setMeta(JSON.parse(savedMeta));
      } catch (error) {
        console.error('Failed to parse saved sync meta:', error);
      }
    }

    // Syncing stays off until the local snapshot is in state, so an empty
    // initial render can never be pushed over good remote data.
    setLoaded(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(QUADRANT_CONFIG_KEY, JSON.stringify(quadrantConfigs));
  }, [quadrantConfigs]);

  useEffect(() => {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }, [meta]);

  useEffect(() => {
    const hasTrackingTasks = todos.some(todo => todo.lastStartTime);
    
    if (timeTrackingInterval) {
      clearInterval(timeTrackingInterval);
      setTimeTrackingInterval(null);
    }
    
    if (hasTrackingTasks) {
      const interval = setInterval(() => {
        const now = Date.now();
        setTodos(prevTodos => 
          prevTodos.map(todo => {
            if (todo.lastStartTime) {
              const elapsed = now - todo.lastStartTime;
              return {
                ...todo,
                timeSpent: todo.timeSpent + elapsed,
                lastStartTime: now,
                updatedAt: now,
              };
            }
            return todo;
          })
        );
      }, 1000);
      
      setTimeTrackingInterval(interval);
    }
    
    return () => {
      if (timeTrackingInterval) {
        clearInterval(timeTrackingInterval);
      }
    };
  }, [todos]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleAddTodo = useCallback((text: string, quadrant: string) => {
    const newTodo: Todo = {
      id: uuidv4(),
      text,
      completed: false,
      quadrant: quadrant as QuadrantType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timeSpent: 0,
      archived: false,
      tags: [],
      comments: []
    };
    setTodos((prevTodos) => [...prevTodos, newTodo]);
  }, []);

  const handleToggleComplete = useCallback((id: string) => {
    setTodos((prevTodos) =>
      prevTodos.map((todo) => {
        if (todo.id === id) {
          const updatedTodo = { 
            ...todo, 
            completed: !todo.completed,
            completedAt: !todo.completed ? Date.now() : undefined,
            updatedAt: Date.now()
          };
          
          if (!todo.completed && todo.lastStartTime) {
            const elapsed = Date.now() - todo.lastStartTime;
            return {
              ...updatedTodo,
              timeSpent: todo.timeSpent + elapsed,
              lastStartTime: undefined,
            };
          }
          
          return updatedTodo;
        }
        return todo;
      })
    );
  }, []);

  // Deletes become tombstones rather than removals: another device that has
  // not synced yet would otherwise treat the missing todo as one it should
  // push back.
  const handleDeleteTodo = useCallback((id: string) => {
    const now = Date.now();
    setTodos((prevTodos) =>
      prevTodos.map((todo) =>
        todo.id === id ? { ...todo, deletedAt: now, updatedAt: now } : todo
      )
    );
  }, []);

  const handleEditTodo = useCallback((id: string, newText: string, newTimeSpent?: number) => {
    setTodos((prevTodos) =>
      prevTodos.map((todo) =>
        todo.id === id 
          ? { 
              ...todo, 
              text: newText.trim() !== todo.text ? newText.trim() : todo.text,
              timeSpent: typeof newTimeSpent === 'number' ? newTimeSpent : todo.timeSpent,
              updatedAt: Date.now()
            } 
          : todo
      )
    );
  }, []);

  const handleTrackTime = useCallback((id: string, isTracking: boolean) => {
    const now = Date.now();
    
    setTodos((prevTodos) =>
      prevTodos.map((todo) => {
        if (todo.id === id) {
          if (isTracking) {
            return { ...todo, lastStartTime: now, updatedAt: now };
          } else {
            const elapsed = todo.lastStartTime ? now - todo.lastStartTime : 0;
            return {
              ...todo,
              timeSpent: todo.timeSpent + elapsed,
              lastStartTime: undefined,
              updatedAt: now,
            };
          }
        }
        return todo;
      })
    );
  }, []);

  // Settings and quadrant colours are merged as whole objects, so every change
  // to them has to move their timestamp.
  const touchSettings = useCallback(() => {
    setMeta(prev => ({ ...prev, settingsUpdatedAt: Date.now() }));
  }, []);

  const handleToggleDarkMode = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      darkMode: !prev.darkMode,
    }));
    touchSettings();
  }, [touchSettings]);

  const handleChangeQuadrantColor = useCallback((quadrantId: string, color: string) => {
    setQuadrantConfigs(prev => 
      prev.map(quadrant => 
        quadrant.id === quadrantId 
          ? { ...quadrant, customColor: color } 
          : quadrant
      )
    );
    setMeta(prev => ({ ...prev, quadrantConfigsUpdatedAt: Date.now() }));
  }, []);

  const handleArchiveTodo = useCallback((id: string) => {
    setTodos((prevTodos) =>
      prevTodos.map((todo) => {
        if (todo.id === id) {
          if (!todo.archived && todo.lastStartTime) {
            const elapsed = Date.now() - todo.lastStartTime;
            return {
              ...todo,
              archived: !todo.archived,
              timeSpent: todo.timeSpent + elapsed,
              lastStartTime: undefined,
              updatedAt: Date.now(),
            };
          }
          return { ...todo, archived: !todo.archived, updatedAt: Date.now() };
        }
        return todo;
      })
    );
  }, []);

  const handleClearCompleted = useCallback(() => {
    if (window.confirm('Are you sure you want to remove all completed tasks?')) {
      const now = Date.now();
      setTodos((prevTodos) =>
        prevTodos.map((todo) =>
          todo.completed && !todo.deletedAt
            ? { ...todo, deletedAt: now, updatedAt: now }
            : todo
        )
      );
    }
  }, []);

  const handleToggleShowArchived = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      showArchived: !prev.showArchived,
    }));
    touchSettings();
  }, [touchSettings]);

  const handleToggleSharing = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      enableSharing: !prev.enableSharing,
    }));
    touchSettings();
  }, [touchSettings]);

  const handleImportData = useCallback((data: BackupData) => {
    if (!data.todos || !data.settings || !data.quadrantConfigs) {
      alert('Invalid backup data format');
      return;
    }

    if (window.confirm('This will replace your current data. Are you sure you want to continue?')) {
      const now = Date.now();
      // An import is an explicit "this is the truth now", so everything it
      // brings is stamped to beat whatever the server still holds.
      setTodos(
        data.todos.map((todo) => ({
          ...todo,
          updatedAt: now,
          createdAt: todo.createdAt || now,
        }))
      );
      setSettings(data.settings);
      setQuadrantConfigs(data.quadrantConfigs);
      setMeta({ settingsUpdatedAt: now, quadrantConfigsUpdatedAt: now });
      alert('Data imported successfully!');
    }
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (overId.startsWith('droppable-')) {
      const quadrantId = over.data?.current?.quadrantId as QuadrantType;
      if (quadrantId) {
        const activeTodo = todos.find(todo => todo.id === activeId);
        if (activeTodo && activeTodo.quadrant !== quadrantId) {
          setTodos(prevTodos => 
            prevTodos.map(todo => 
              todo.id === activeId
                ? { ...todo, quadrant: quadrantId, updatedAt: Date.now() }
                : todo
            )
          );
        }
        return;
      }
    }
    
    const activeTodo = todos.find(todo => todo.id === activeId);
    const overTodo = todos.find(todo => todo.id === overId);
    
    if (!activeTodo || !overTodo || activeTodo.quadrant === overTodo.quadrant) return;
    
    setTodos(prevTodos => 
      prevTodos.map(todo => 
        todo.id === activeId
          ? { ...todo, quadrant: overTodo.quadrant, updatedAt: Date.now() }
          : todo
      )
    );
  }, [todos]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (overId.startsWith('droppable-')) {
      setActiveId(null);
      return;
    }
    
    if (activeId === overId) return;
    
    setTodos(prevTodos => {
      const activeIndex = prevTodos.findIndex(todo => todo.id === activeId);
      const overIndex = prevTodos.findIndex(todo => todo.id === overId);
      
      return arrayMove(prevTodos, activeIndex, overIndex);
    });
    
    setActiveId(null);
  }, []);

  // `todos` holds tombstones so they can be synced; the UI only ever sees
  // the live ones.
  const activeTodos = useMemo(() => visibleTodos(todos), [todos]);

  const getQuadrantTodos = useCallback(
    (quadrantId: QuadrantType) => {
      return activeTodos.filter((todo) => todo.quadrant === quadrantId);
    },
    [activeTodos]
  );

  const calculateStats = useCallback((): StatsType => {
    const stats: StatsType = {
      totalTasks: activeTodos.length,
      completedTasks: activeTodos.filter(todo => todo.completed).length,
      totalTimeSpent: activeTodos.reduce((total, todo) => total + todo.timeSpent, 0),
      quadrants: {
        urgentImportant: { total: 0, completed: 0, timeSpent: 0 },
        importantNotUrgent: { total: 0, completed: 0, timeSpent: 0 },
        urgentNotImportant: { total: 0, completed: 0, timeSpent: 0 },
        notUrgentNotImportant: { total: 0, completed: 0, timeSpent: 0 },
      }
    };

    activeTodos.forEach(todo => {
      const quadrant = todo.quadrant;
      stats.quadrants[quadrant].total++;
      if (todo.completed) {
        stats.quadrants[quadrant].completed++;
      }
      stats.quadrants[quadrant].timeSpent += todo.timeSpent;
      
      if (todo.lastStartTime) {
        const currentTracking = Date.now() - todo.lastStartTime;
        stats.quadrants[quadrant].timeSpent += currentTracking;
        stats.totalTimeSpent += currentTracking;
      }
    });

    return stats;
  }, [activeTodos]);

  const syncSnapshot = useMemo<SyncState>(
    () => ({ todos, settings, quadrantConfigs, meta }),
    [todos, settings, quadrantConfigs, meta]
  );

  const applyMerged = useCallback((merged: SyncState) => {
    setTodos(merged.todos);
    setSettings(merged.settings);
    setQuadrantConfigs(merged.quadrantConfigs);
    setMeta(merged.meta);
  }, []);

  const sync = useSync({ state: syncSnapshot, apply: applyMerged, ready: loaded });

  return (
    <div className={`min-h-screen w-full ${settings.darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
      <div className="flex flex-col min-h-screen">
        <Header 
          darkMode={settings.darkMode} 
          onToggleDarkMode={handleToggleDarkMode}
          onToggleStats={() => setShowStats(!showStats)}
          showStats={showStats}
          todos={activeTodos}
          quadrantConfigs={quadrantConfigs}
          settings={settings}
          onImportData={handleImportData}
          onClearCompleted={handleClearCompleted}
          onToggleShowArchived={handleToggleShowArchived}
          onToggleSharing={handleToggleSharing}
          syncConfig={sync.config}
          syncStatus={sync.status}
          syncLocked={sync.locked}
          onSaveSyncConfig={sync.setConfig}
          onUnlockSync={sync.unlock}
          onForgetSync={sync.forget}
          onSyncNow={sync.sync}
        />
        
        <div className="flex-grow p-2 md:p-6">
          <div className="max-w-7xl mx-auto px-2 md:px-0">
            {showStats && (
              <div className="mb-3 md:mb-6">
                <Statistics stats={calculateStats()} darkMode={settings.darkMode} />
              </div>
            )}
            
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                {quadrantConfigs.map((quadrant) => (
                  <TodoList
                    key={quadrant.id}
                    todos={getQuadrantTodos(quadrant.id)}
                    quadrant={quadrant}
                    onAddTodo={handleAddTodo}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteTodo}
                    onEdit={handleEditTodo}
                    onTrackTime={handleTrackTime}
                    onChangeColor={handleChangeQuadrantColor}
                    onArchive={handleArchiveTodo}
                    darkMode={settings.darkMode}
                    showArchived={settings.showArchived}
                    enableSharing={settings.enableSharing}
                  />
                ))}
              </div>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;