import React, { useState, useCallback, useEffect } from 'react';
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
import { Todo, QuadrantType, QuadrantConfig, AppSettings, Statistics as StatsType, BackupData } from './types';
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quadrantConfigs, setQuadrantConfigs] = useState<QuadrantConfig[]>(defaultQuadrantConfigs);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [showStats, setShowStats] = useState(false);
  const [timeTrackingInterval, setTimeTrackingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedTodos = localStorage.getItem(STORAGE_KEY);
    if (savedTodos) {
      try {
        const parsedTodos = JSON.parse(savedTodos);
        const updatedTodos = parsedTodos.map((todo: any) => ({
          ...todo,
          createdAt: todo.createdAt || Date.now(),
          timeSpent: todo.timeSpent || 0,
          lastStartTime: todo.lastStartTime || undefined,
          archived: todo.archived || false,
        }));
        setTodos(updatedTodos);
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
            completedAt: !todo.completed ? Date.now() : undefined
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

  const handleDeleteTodo = useCallback((id: string) => {
    setTodos((prevTodos) => prevTodos.filter((todo) => todo.id !== id));
  }, []);

  const handleEditTodo = useCallback((id: string, newText: string, newTimeSpent?: number) => {
    setTodos((prevTodos) =>
      prevTodos.map((todo) =>
        todo.id === id 
          ? { 
              ...todo, 
              text: newText.trim() !== todo.text ? newText.trim() : todo.text,
              timeSpent: typeof newTimeSpent === 'number' ? newTimeSpent : todo.timeSpent
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
            return { ...todo, lastStartTime: now };
          } else {
            const elapsed = todo.lastStartTime ? now - todo.lastStartTime : 0;
            return {
              ...todo,
              timeSpent: todo.timeSpent + elapsed,
              lastStartTime: undefined,
            };
          }
        }
        return todo;
      })
    );
  }, []);

  const handleToggleDarkMode = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      darkMode: !prev.darkMode,
    }));
  }, []);

  const handleChangeQuadrantColor = useCallback((quadrantId: string, color: string) => {
    setQuadrantConfigs(prev => 
      prev.map(quadrant => 
        quadrant.id === quadrantId 
          ? { ...quadrant, customColor: color } 
          : quadrant
      )
    );
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
            };
          }
          return { ...todo, archived: !todo.archived };
        }
        return todo;
      })
    );
  }, []);

  const handleClearCompleted = useCallback(() => {
    if (window.confirm('Are you sure you want to remove all completed tasks?')) {
      setTodos((prevTodos) => prevTodos.filter((todo) => !todo.completed));
    }
  }, []);

  const handleToggleShowArchived = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      showArchived: !prev.showArchived,
    }));
  }, []);

  const handleToggleSharing = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      enableSharing: !prev.enableSharing,
    }));
  }, []);

  const handleImportData = useCallback((data: BackupData) => {
    if (!data.todos || !data.settings || !data.quadrantConfigs) {
      alert('Invalid backup data format');
      return;
    }

    if (window.confirm('This will replace your current data. Are you sure you want to continue?')) {
      setTodos(data.todos);
      setSettings(data.settings);
      setQuadrantConfigs(data.quadrantConfigs);
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
              todo.id === activeId ? { ...todo, quadrant: quadrantId } : todo
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
        todo.id === activeId ? { ...todo, quadrant: overTodo.quadrant } : todo
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

  const getQuadrantTodos = useCallback(
    (quadrantId: QuadrantType) => {
      return todos.filter((todo) => todo.quadrant === quadrantId);
    },
    [todos]
  );

  const calculateStats = useCallback((): StatsType => {
    const stats: StatsType = {
      totalTasks: todos.length,
      completedTasks: todos.filter(todo => todo.completed).length,
      totalTimeSpent: todos.reduce((total, todo) => total + todo.timeSpent, 0),
      quadrants: {
        urgentImportant: { total: 0, completed: 0, timeSpent: 0 },
        importantNotUrgent: { total: 0, completed: 0, timeSpent: 0 },
        urgentNotImportant: { total: 0, completed: 0, timeSpent: 0 },
        notUrgentNotImportant: { total: 0, completed: 0, timeSpent: 0 },
      }
    };

    todos.forEach(todo => {
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
  }, [todos]);

  return (
    <div className={`min-h-screen w-full ${settings.darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
      <div className="flex flex-col min-h-screen">
        <Header 
          darkMode={settings.darkMode} 
          onToggleDarkMode={handleToggleDarkMode}
          onToggleStats={() => setShowStats(!showStats)}
          showStats={showStats}
          todos={todos}
          quadrantConfigs={quadrantConfigs}
          settings={settings}
          onImportData={handleImportData}
          onClearCompleted={handleClearCompleted}
          onToggleShowArchived={handleToggleShowArchived}
          onToggleSharing={handleToggleSharing}
        />
        
        <div className="flex-grow p-6">
          <div className="max-w-7xl mx-auto">
            {showStats && (
              <div className="mb-6">
                <Statistics stats={calculateStats()} darkMode={settings.darkMode} />
              </div>
            )}
            
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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