import React, { useState, useEffect } from 'react';
import { Users, Search, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { User } from '../../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: 'todo' | 'category';
  resourceId: string;
  resourceName: string;
  currentSharedUsers: { userId: string; access: string }[];
  onShare: (userId: string, access: 'read' | 'write' | 'admin') => Promise<void>;
  onUpdateAccess: (userId: string, access: 'read' | 'write' | 'admin') => Promise<void>;
  onRemoveAccess: (userId: string) => Promise<void>;
  darkMode: boolean;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  resourceType,
  resourceId,
  resourceName,
  currentSharedUsers,
  onShare,
  onUpdateAccess,
  onRemoveAccess,
  darkMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isAddingNewUser, setIsAddingNewUser] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .ilike('email', `%${searchQuery}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      setError('Failed to search users');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShareWithNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First check if user already exists
      const { data: existingUsers, error: searchError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', newUserEmail.trim())
        .limit(1);

      if (searchError) throw searchError;

      if (existingUsers && existingUsers.length > 0) {
        // User exists, share directly
        await onShare(existingUsers[0].id, 'read');
        setNewUserEmail('');
        setIsAddingNewUser(false);
      } else {
        // Create a temporary user record
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: newUserEmail.trim(),
            name: newUserEmail.split('@')[0], // Use part before @ as temporary name
          })
          .select()
          .single();

        if (createError) throw createError;

        // Share with the new user
        if (newUser) {
          await onShare(newUser.id, 'read');
          setNewUserEmail('');
          setIsAddingNewUser(false);
        }
      }
    } catch (err) {
      console.error('Error sharing with new user:', err);
      setError('Failed to share with the user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`w-full max-w-md p-6 rounded-lg shadow-xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Share {resourceType === 'todo' ? 'Task' : 'Category'}
          </h2>
          <button
            onClick={onClose}
            className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700`}
          >
            <X size={20} className={darkMode ? 'text-gray-300' : 'text-gray-500'} />
          </button>
        </div>

        <p className={`mb-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {resourceName}
        </p>

        <div className="mb-6">
          <div className="relative">
            <Search 
              size={18} 
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`} 
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by email..."
              className={`w-full pl-10 pr-4 py-2 rounded-md ${
                darkMode 
                  ? 'bg-gray-700 text-white border-gray-600' 
                  : 'bg-white border-gray-300'
              }`}
            />
          </div>

          {!searchResults.length && searchQuery.trim().length >= 2 && !loading && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setIsAddingNewUser(true);
                  setNewUserEmail(searchQuery);
                }}
                className={`w-full p-3 rounded-md text-left ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Invite new user
                </p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {searchQuery}
                </p>
              </button>
            </div>
          )}

          {isAddingNewUser && (
            <form onSubmit={handleShareWithNewUser} className="mt-4">
              <div className="mb-4">
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email address
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className={`w-full p-2 rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 text-white border-gray-600' 
                      : 'bg-white border-gray-300'
                  }`}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNewUser(false)}
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
                  disabled={loading}
                  className="px-3 py-1 rounded-md bg-blue-500 text-white hover:bg-blue-600"
                >
                  {loading ? 'Sharing...' : 'Share'}
                </button>
              </div>
            </form>
          )}

          {loading && (
            <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Searching...
            </p>
          )}

          {error && (
            <div className="mt-2 p-2 rounded-md bg-red-100 dark:bg-red-900/20 flex items-center">
              <AlertCircle size={16} className="text-red-500 mr-2" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-2 space-y-2">
              {searchResults.map((user) => {
                const isShared = currentSharedUsers.some(u => u.userId === user.id);
                return (
                  <div
                    key={user.id}
                    className={`p-2 rounded-md flex items-center justify-between ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="w-8 h-8 rounded-full mr-2"
                        />
                      ) : (
                        <div className={`w-8 h-8 rounded-full mr-2 flex items-center justify-center ${
                          darkMode ? 'bg-gray-600' : 'bg-gray-200'
                        }`}>
                          <Users size={16} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
                        </div>
                      )}
                      <div>
                        <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {user.name}
                        </p>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                    {isShared ? (
                      <select
                        value={currentSharedUsers.find(u => u.userId === user.id)?.access}
                        onChange={(e) => onUpdateAccess(user.id, e.target.value as 'read' | 'write' | 'admin')}
                        className={`text-sm rounded-md ${
                          darkMode 
                            ? 'bg-gray-600 text-white border-gray-500' 
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        <option value="read">Read</option>
                        <option value="write">Write</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => onShare(user.id, 'read')}
                        className="px-3 py-1 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600"
                      >
                        Share
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} pt-4`}>
          <h3 className={`text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Shared with
          </h3>
          {currentSharedUsers.length === 0 ? (
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Not shared with anyone yet
            </p>
          ) : (
            <div className="space-y-2">
              {currentSharedUsers.map((sharedUser) => (
                <div
                  key={sharedUser.userId}
                  className={`p-2 rounded-md flex items-center justify-between ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <Users size={16} className={`mr-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                    <span className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {sharedUser.userId}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={sharedUser.access}
                      onChange={(e) => onUpdateAccess(sharedUser.userId, e.target.value as 'read' | 'write' | 'admin')}
                      className={`text-sm rounded-md ${
                        darkMode 
                          ? 'bg-gray-600 text-white border-gray-500' 
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      <option value="read">Read</option>
                      <option value="write">Write</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => onRemoveAccess(sharedUser.userId)}
                      className="p-1 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;