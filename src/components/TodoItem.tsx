import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Trash2, GripVertical, Save, X, Clock, Play, Pause, Archive } from 'lucide-react';
import { Todo } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface TodoItemProps {
  todo: Todo;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string, newTimeSpent?: number) => void;
  onTrackTime: (id: string, isTracking: boolean) => void;
  onArchive: (id: string) => void;
  darkMode: boolean;
  enableSharing: boolean;
}

const TodoItem: React.FC<TodoItemProps> = ({ 
  todo, 
  onToggleComplete, 
  onDelete, 
  onEdit, 
  onTrackTime,
  onArchive,
  darkMode
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [editTimeHours, setEditTimeHours] = useState(Math.floor(todo.timeSpent / (1000 * 60 * 60)));
  const [editTimeMinutes, setEditTimeMinutes] = useState(Math.floor((todo.timeSpent % (1000 * 60 * 60)) / (1000 * 60)));
  const editFormRef = useRef<HTMLFormElement>(null);
  const editTimeFormRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const isTracking = !!todo.lastStartTime;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && editFormRef.current && !editFormRef.current.contains(event.target as Node)) {
        handleEditSubmit();
      }
      if (isEditingTime && editTimeFormRef.current && !editTimeFormRef.current.contains(event.target as Node)) {
        handleEditTimeSubmit();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, isEditingTime, editText, editTimeHours, editTimeMinutes]);

  const handleEditSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editText.trim() !== todo.text) {
      onEdit(todo.id, editText);
    }
    setIsEditing(false);
  };

  const handleEditTimeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newTimeInMs = (editTimeHours * 60 * 60 * 1000) + (editTimeMinutes * 60 * 1000);
    if (newTimeInMs !== todo.timeSpent) {
      onEdit(todo.id, todo.text, newTimeInMs);
    }
    setIsEditingTime(false);
  };

  const handleCancelEdit = () => {
    setEditText(todo.text);
    setIsEditing(false);
  };

  const handleCancelEditTime = () => {
    setEditTimeHours(Math.floor(todo.timeSpent / (1000 * 60 * 60)));
    setEditTimeMinutes(Math.floor((todo.timeSpent % (1000 * 60 * 60)) / (1000 * 60)));
    setIsEditingTime(false);
  };

  const handleTextClick = (e: React.MouseEvent) => {
    if (
      e.target instanceof HTMLElement && 
      !e.target.closest('button') && 
      !e.target.closest('[data-drag-handle]') &&
      !e.target.closest('[data-time-section]')
    ) {
      setIsEditing(true);
    }
  };

  const handleTimeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!todo.archived && !isTracking && !todo.completed) {
      setIsEditingTime(true);
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getCreatedTimeAgo = () => {
    return formatDistanceToNow(todo.createdAt, { addSuffix: true });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-stretch p-2.5 md:p-2 mb-1 rounded-md shadow-sm border-l-4 min-h-[4.5rem] ${
        todo.archived 
          ? 'border-gray-500 bg-gray-100 dark:bg-gray-700/30' 
          : todo.completed 
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
            : `border-gray-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
      }`}
    >
      <div className="flex flex-col mr-2">
        {!isEditing && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            data-drag-handle="true"
          >
            <GripVertical size={16} />
          </div>
        )}

        <div className="flex-grow flex items-end">
          {!isEditing && (
            <button
              onClick={() => onToggleComplete(todo.id)}
              className={`flex-shrink-0 w-5 h-5 rounded-full border ${
                todo.completed
                  ? 'bg-green-500 border-green-500 text-white'
                  : `border-gray-300 hover:border-green-500 ${darkMode ? 'dark:border-gray-600 dark:hover:border-green-400' : ''}`
              } flex items-center justify-center`}
            >
              {todo.completed && <Check size={12} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-w-0">
        {isEditing ? (
          <form ref={editFormRef} onSubmit={handleEditSubmit} className="flex-grow flex items-center">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className={`flex-grow p-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode ? 'bg-gray-700 text-white border-blue-700' : ''
              }`}
              autoFocus
            />
            <div className="flex ml-2">
              <button
                type="submit"
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 mr-1"
                title="Save"
              >
                <Save size={16} />
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          </form>
        ) : (
          <>
            <div 
              className="flex-grow min-w-0 pr-2 md:pr-4"
              onClick={handleTextClick}
            >
              <p 
                ref={textRef}
                className={`text-sm cursor-pointer break-words ${
                  todo.archived
                    ? 'text-gray-500 dark:text-gray-400'
                    : todo.completed 
                      ? 'line-through text-gray-500 dark:text-gray-400' 
                      : `${darkMode ? 'text-gray-200' : 'text-gray-700'}`
                }`}
              >
                {todo.text}
              </p>
              <div className="hidden md:flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>Created {getCreatedTimeAgo()}</span>
                {todo.archived && <span className="ml-2 px-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Archived</span>}
              </div>
            </div>

            <div className="flex flex-col justify-between items-end">
              <div className="flex flex-col items-end">
                {!todo.archived && !todo.completed && (
                  <button
                    onClick={() => onTrackTime(todo.id, !isTracking)}
                    className={`${
                      isTracking 
                        ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300' 
                        : 'text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
                    }`}
                    title={isTracking ? "Pause tracking" : "Start tracking"}
                  >
                    {isTracking ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                )}
                <div 
                  data-time-section="true" 
                  className="text-xs text-gray-500 dark:text-gray-400 mt-1"
                  onClick={handleTimeClick}
                >
                  <span className={`cursor-pointer ${!todo.archived && !isTracking && !todo.completed ? 'hover:text-blue-500 dark:hover:text-blue-400' : ''}`}>
                    {formatTime(todo.timeSpent)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => onArchive(todo.id)}
                  className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-purple-500 dark:hover:text-purple-400"
                  title={todo.archived ? "Unarchive" : "Archive"}
                >
                  <Archive size={16} />
                </button>
                <button
                  onClick={() => onDelete(todo.id)}
                  className="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-30"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TodoItem;