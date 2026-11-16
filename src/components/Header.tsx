import React, { useState, useRef } from 'react';
import {
  Sun, Moon, BarChart2, Download, Upload, Archive, Trash2, Save, Share2,
  Cloud, CloudOff, RefreshCw, AlertCircle,
} from 'lucide-react';
import { BackupData, Todo, QuadrantConfig, AppSettings, SyncConfig, SyncStatus } from '../types';

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
  syncConfig: SyncConfig;
  syncStatus: SyncStatus;
  syncLocked: boolean;
  onSaveSyncConfig: (config: SyncConfig) => void;
  onUnlockSync: (passphrase: string) => Promise<void>;
  onForgetSync: () => void;
  onSyncNow: () => void;
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
  onToggleSharing,
  syncConfig,
  syncStatus,
  syncLocked,
  onSaveSyncConfig,
  onUnlockSync,
  onForgetSync,
  onSyncNow
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [endpoint, setEndpoint] = useState(syncConfig.endpoint);
  const [token, setToken] = useState(syncConfig.token);
  const [passphrase, setPassphrase] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSync = (enabled: boolean) => {
    onSaveSyncConfig({ enabled, endpoint: endpoint.trim(), token: token.trim() });
  };

  const handleUnlock = async () => {
    if (!passphrase) return;
    setUnlocking(true);
    try {
      await onUnlockSync(passphrase);
      setPassphrase('');
    } catch {
      // The error is already surfaced through syncStatus.
    } finally {
      setUnlocking(false);
    }
  };

  const syncLabel = () => {
    if (!syncConfig.enabled) return 'Sync off';
    if (syncLocked) return 'Passphrase needed';
    if (syncStatus.phase === 'syncing') return 'Syncing...';
    if (syncStatus.phase === 'error') return syncStatus.error || 'Sync error';
    if (syncStatus.lastSyncedAt) {
      return `Synced ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString()}`;
    }
    return 'Sync on';
  };

  const syncIcon = () => {
    if (!syncConfig.enabled) return <CloudOff size={20} />;
    if (syncStatus.phase === 'syncing') return <RefreshCw size={20} className="animate-spin" />;
    if (syncStatus.phase === 'error' || syncLocked) return <AlertCircle size={20} />;
    return <Cloud size={20} />;
  };

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
          
          <div className="relative">
            <button
              onClick={() => setShowSync(!showSync)}
              className={`p-2 rounded-full ${
                syncStatus.phase === 'error' && syncConfig.enabled
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                  : darkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
              }`}
              title={syncLabel()}
            >
              {syncIcon()}
            </button>

            {showSync && (
              <div className={`absolute right-0 mt-2 w-80 rounded-md shadow-lg p-4 z-10 text-sm ${
                darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">Sync</span>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={syncConfig.enabled}
                      onChange={(e) => handleSaveSync(e.target.checked)}
                    />
                    Enabled
                  </label>
                </div>

                <label className="block text-xs mb-1 opacity-70">Endpoint</label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  onBlur={() => handleSaveSync(syncConfig.enabled)}
                  className="w-full mb-3 px-2 py-1 rounded border bg-transparent border-gray-400 dark:border-gray-600"
                />

                <label className="block text-xs mb-1 opacity-70">Server token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onBlur={() => handleSaveSync(syncConfig.enabled)}
                  autoComplete="off"
                  className="w-full mb-3 px-2 py-1 rounded border bg-transparent border-gray-400 dark:border-gray-600"
                />

                {syncLocked ? (
                  <>
                    <label className="block text-xs mb-1 opacity-70">Passphrase</label>
                    <input
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleUnlock(); }}
                      autoComplete="off"
                      className="w-full mb-1 px-2 py-1 rounded border bg-transparent border-gray-400 dark:border-gray-600"
                    />
                    <p className="text-xs opacity-60 mb-3">
                      Encrypts your data before it leaves this device. There is no recovery if
                      you lose it &mdash; keep a JSON export as a backup.
                    </p>
                    <button
                      onClick={() => void handleUnlock()}
                      disabled={unlocking || !passphrase}
                      className="w-full px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
                    >
                      {unlocking ? 'Checking...' : 'Unlock'}
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={onSyncNow}
                      className="flex-1 px-3 py-1.5 rounded bg-blue-600 text-white"
                    >
                      Sync now
                    </button>
                    <button
                      onClick={onForgetSync}
                      className="px-3 py-1.5 rounded border border-gray-400 dark:border-gray-600"
                      title="Forget the saved key on this device"
                    >
                      Lock
                    </button>
                  </div>
                )}

                <p className={`mt-3 text-xs ${
                  syncStatus.phase === 'error' ? 'text-red-500' : 'opacity-60'
                }`}>
                  {syncLabel()}
                </p>
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