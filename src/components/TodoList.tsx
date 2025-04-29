import React, { useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus, Palette } from 'lucide-react';
import TodoItem from './TodoItem';
import { Todo, QuadrantConfig } from '../types';

interface TodoListProps {
  todos: Todo[];
  quadrant: QuadrantConfig;
  onAddTodo: (text: string, quadrant: string) => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onTrackTime: (id: string, isTracking: boolean) => void;
  onChangeColor: (quadrantId: string, color: string) => void;
  onArchive: (id: string) => void;
  darkMode: boolean;
  showArchived: boolean;
  enableSharing: boolean;
}

const TodoList: React.FC<TodoListProps> = ({
  todos,
  quadrant,
  onAddTodo,
  onToggleComplete,
  onDelete,
  onEdit,
  onTrackTime,
  onChangeColor,
  onArchive,
  darkMode,
  showArchived,
  enableSharing,
}) => {
  const [newTodoText, setNewTodoText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { setNodeRef } = useDroppable({
    id: `droppable-${quadrant.id}`,
    data: {
      quadrantId: quadrant.id,
      type: 'quadrant'
    }
  });

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      onAddTodo(newTodoText.trim(), quadrant.id);
      setNewTodoText('');
    }
  };

  const predefinedColors = [
    { name: 'Red', value: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700' },
    { name: 'Blue', value: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700' },
    { name: 'Green', value: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' },
    { name: 'Yellow', value: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700' },
    { name: 'Purple', value: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700' },
    { name: 'Pink', value: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-700' },
    { name: 'Indigo', value: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-700' },
    { name: 'Teal', value: 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-700' },
  ];

  const getBackgroundColor = () => {
    if (quadrant.customColor) {
      return quadrant.customColor;
    }
    return `${quadrant.bgColor} ${quadrant.borderColor} ${darkMode ? 'dark:bg-gray-800/50 dark:border-gray-700' : ''}`;
  };

  const filteredTodos = todos.filter(todo => showArchived || !todo.archived);

  return (
    <div 
      ref={setNodeRef}
      className={`h-full flex flex-col rounded-lg p-3 md:p-4 border ${getBackgroundColor()} ${
        filteredTodos.length === 0 ? 'relative' : ''
      }`}
    >
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{quadrant.title}</h2>
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{quadrant.description}</p>
        </div>
        <div className="flex items-center">
          <button 
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 ${
              showColorPicker ? 'bg-gray-200 dark:bg-gray-700' : ''
            }`}
            title="Change color"
          >
            <Palette size={16} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
          </button>
        </div>
      </div>

      {showColorPicker && (
        <div className="mb-4 p-2 bg-white dark:bg-gray-700 rounded-md shadow-md">
          <div className="text-sm font-medium mb-2 dark:text-white">Choose a color:</div>
          <div className="grid grid-cols-4 gap-2">
            {predefinedColors.map((color) => (
              <button
                key={color.name}
                onClick={() => {
                  onChangeColor(quadrant.id, color.value);
                  setShowColorPicker(false);
                }}
                className={`w-full h-8 rounded border ${color.value.split(' ')[0]} ${color.value.split(' ')[1]} hover:opacity-80`}
                title={color.name}
              />
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleAddTodo} className="mb-4 flex">
        <input
          type="text"
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          placeholder="Add a new task..."
          className={`flex-grow p-2 text-sm border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            darkMode 
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
              : 'border-gray-300'
          }`}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus size={20} />
        </button>
      </form>

      <div className="flex-grow overflow-y-auto px-1">
        {filteredTodos.length > 0 ? (
          <SortableContext items={filteredTodos.map(todo => todo.id)} strategy={verticalListSortingStrategy}>
            {filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onEdit={onEdit}
                onTrackTime={onTrackTime}
                onArchive={onArchive}
                darkMode={darkMode}
                enableSharing={enableSharing}
              />
            ))}
          </SortableContext>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className={`text-center p-4 md:p-6 border-2 border-dashed rounded-lg w-full ${
              darkMode ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-300'
            }`}>
              <p>Drop tasks here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoList;