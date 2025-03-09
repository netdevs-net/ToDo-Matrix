import React, { useState, useRef } from 'react';
import { Sun, Moon, BarChart2, Download, Upload, Archive, Trash2, Save, Share2 } from 'lucide-react';
import { BackupData, Todo, QuadrantConfig, AppSettings } from '../types';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onToggleStats: () => void;
  showStats: boolean;
  todos: Todo[];
  quadrantConfigs: QuadrantConfig[];
  settings: AppSettings;
  onImportData: (data: BackupData) => void;
  onClearCompleted: () => void;
  onToggleShowArchived: () => void;
  onToggleSharing: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  darkMode, 
  onToggleDarkMode, 
  onToggleStats, 
  showStats,
  todos,
  quadrantConfigs,
  settings,
  onImportData,
  onClearCompleted,
  onToggleShowArchived,
  onToggleSharing
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const backupData: BackupData = {
      todos,
      settings,
      quadrantConfigs,
      version: '1.0',
      timestamp: Date.now()
    };
    
    const dataStr = JSON.stringify(backupData, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `todo-matrix-backup-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    setShowMenu(false);
  };

  const handleExportCSV = () => {
    const csvHeader = ['ID', 'Task', 'Quadrant', 'Completed', 'Created At', 'Completed At', 'Time Spent (ms)', 'Archived'];
    
    const csvRows = todos.map(todo => [
      todo.id,
      `"${todo.text.replace(/"/g, '""')}"`,
      todo.quadrant,
      todo.completed ? 'Yes' : 'No',
      new Date(todo.createdAt).toISOString(),
      todo.completedAt ? new Date(todo.completedAt).toISOString() : '',
      todo.timeSpent.toString(),
      todo.archived ? 'Yes' : 'No'
    ]);
    
    const csvContent = [
      csvHeader.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');
    
    const dataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
    const exportFileDefaultName = `todo-matrix-export-${new Date().toISOString().slice(0, 10)}.csv`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    setShowMenu(false);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
    setShowMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as BackupData;
        onImportData(data);
      } catch (error) {
        alert('Failed to import data. The file may be corrupted or in an invalid format.');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    
    if (e.target) {
      e.target.value = '';
    }
  };

  return (
    <header className={`py-4 px-6 ${darkMode ? 'bg-gray-900' : 'bg-white'} shadow-md`}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 className={`text-2xl md:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
          ToDo Matrix
        </h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`p-2 rounded-full ${
                darkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Menu"
            >
              <Save size={20} />
            </button>
            
            {showMenu && (
              <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-10 ${
                darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
              }`}>
                <button
                  onClick={handleExport}
                  className="flex items-center px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Download size={16} className="mr-2" />
                  Export (JSON)
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Download size={16} className="mr-2" />
                  Export (CSV)
                </button>
                <button
                  onClick={handleImportClick}
                  className="flex items-center px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Upload size={16} className="mr-2" />
                  Import
                </button>
                <hr className={`my-1 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} />
                <button
                  onClick={() => {
                    onToggleShowArchived();
                    setShowMenu(false);
                  }}
                  className="flex items-center px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Archive size={16} className="mr-2" />
                  {settings.showArchived ? 'Hide Archived' : 'Show Archived'}
                </button>
                <button
                  onClick={() => {
                    onToggleSharing();
                    setShowMenu(false);
                  }}
                  className="flex items-center px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Share2 size={16} className="mr-2" />
                  {settings.enableSharing ? 'Disable Sharing' : 'Enable Sharing'}
                </button>
                <button
                  onClick={() => {
                    onClearCompleted();
                    setShowMenu(false);
                  }}
                  className="flex items-center px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Trash2 size={16} className="mr-2" />
                  Clear Completed
                </button>
              </div>
            )}
          </div>
          
          <button
            onClick={onToggleStats}
            className={`p-2 rounded-full ${
              showStats 
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
                : 'hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-800 dark:text-gray-300'
            }`}
            title={showStats ? "Hide statistics" : "Show statistics"}
          >
            <BarChart2 size={20} />
          </button>
          <button
            onClick={onToggleDarkMode}
            className={`p-2 rounded-full ${
              darkMode 
                ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300' 
                : 'bg-indigo-100 text-indigo-600'
            }`}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json" 
        className="hidden" 
      />
    </header>
  );
};

export default Header;