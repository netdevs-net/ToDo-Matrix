import React, { useState } from 'react';
import { Users, Plus, Settings } from 'lucide-react';
import type { Workspace } from '../../types';

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onCreateWorkspace: (name: string, description?: string) => void;
  darkMode: boolean;
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  darkMode,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWorkspaceName.trim()) {
      onCreateWorkspace(newWorkspaceName.trim(), newWorkspaceDescription.trim());
      setIsCreating(false);
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
    }
  };

  return (
    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Users size={20} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
          <h3 className={`ml-2 text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Workspaces
          </h3>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Plus size={20} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
        </button>
      </div>

      {isCreating ? (
        <form onSubmit={handleCreateSubmit} className="space-y-4 mb-4">
          <div>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Workspace name"
              className={`w-full p-2 text-sm rounded-md ${
                darkMode
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'bg-white border-gray-300'
              }`}
              autoFocus
            />
          </div>
          <div>
            <textarea
              value={newWorkspaceDescription}
              onChange={(e) => setNewWorkspaceDescription(e.target.value)}
              placeholder="Description (optional)"
              className={`w-full p-2 text-sm rounded-md ${
                darkMode
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'bg-white border-gray-300'
              }`}
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className={`px-3 py-1 rounded-md ${
                darkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newWorkspaceName.trim()}
              className={`px-3 py-1 rounded-md text-white ${
                newWorkspaceName.trim()
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Create
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              onClick={() => onSelectWorkspace(workspace)}
              className={`p-3 rounded-lg cursor-pointer flex items-center justify-between ${
                workspace.id === currentWorkspace?.id
                  ? darkMode
                    ? 'bg-blue-900/20 border border-blue-500'
                    : 'bg-blue-50 border border-blue-200'
                  : darkMode
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div>
                <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {workspace.name}
                </h4>
                {workspace.description && (
                  <p className="text-sm text-gray-500">{workspace.description}</p>
                )}
              </div>
              <Settings size={16} className="text-gray-400" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelector;