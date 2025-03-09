import React, { useState, useEffect } from 'react';
import { Folder, Plus, Share2, Edit2, Trash2, X, Save } from 'lucide-react';
import { Category } from '../../types';
import ShareModal from '../sharing/ShareModal';
import { useSharing } from '../../hooks/useSharing';
import { supabase } from '../../lib/supabase';

interface CategoryManagerProps {
  darkMode: boolean;
  workspaceId?: string;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ darkMode, workspaceId }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', color: '#3B82F6' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [sharedUsers, setSharedUsers] = useState<{ userId: string; access: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { shareResource, updateAccess, removeAccess, getSharedUsers } = useSharing('category');

  useEffect(() => {
    if (workspaceId) {
      loadCategories();
    } else {
      setCategories([]);
    }
  }, [workspaceId]);

  const loadCategories = async () => {
    if (!workspaceId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) {
      setError('Please select a workspace first');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: newCategory.name,
          description: newCategory.description,
          color: newCategory.color,
          workspace_id: workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      setCategories([...categories, data]);
      setNewCategory({ name: '', description: '', color: '#3B82F6' });
      setError(null);
    } catch (error) {
      console.error('Error creating category:', error);
      setError('Failed to create category');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: editingCategory.name,
          description: editingCategory.description,
          color: editingCategory.color,
        })
        .eq('id', editingCategory.id);

      if (error) throw error;
      setCategories(categories.map(cat => 
        cat.id === editingCategory.id ? editingCategory : cat
      ));
      setEditingCategory(null);
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
      setCategories(categories.filter(cat => cat.id !== categoryId));
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleShare = async (category: Category) => {
    setSelectedCategory(category);
    try {
      const users = await getSharedUsers(category.id);
      setSharedUsers(users.map(u => ({
        userId: u.user_id,
        access: u.access
      })));
      setShowShareModal(true);
    } catch (error) {
      console.error('Error loading shared users:', error);
    }
  };

  return (
    <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Folder className={`mr-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Categories
          </h2>
        </div>
        {!workspaceId && (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Select a workspace to manage categories
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Loading categories...
        </div>
      ) : (
        <>
          {workspaceId && (
            <form onSubmit={handleCreateCategory} className="mb-6">
              <div className="flex flex-col space-y-4">
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Category name"
                  className={`p-2 rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 text-white border-gray-600' 
                      : 'bg-white border-gray-300'
                  }`}
                />
                <input
                  type="text"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="Description (optional)"
                  className={`p-2 rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 text-white border-gray-600' 
                      : 'bg-white border-gray-300'
                  }`}
                />
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <button
                    type="submit"
                    disabled={!newCategory.name.trim()}
                    className={`flex items-center px-4 py-2 rounded-md ${
                      newCategory.name.trim()
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus size={16} className="mr-2" />
                    Add Category
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`p-4 rounded-lg ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                {editingCategory?.id === category.id ? (
                  <form onSubmit={handleUpdateCategory} className="space-y-4">
                    <input
                      type="text"
                      value={editingCategory.name}
                      onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? 'bg-gray-600 text-white border-gray-500' 
                          : 'bg-white border-gray-300'
                      }`}
                    />
                    <input
                      type="text"
                      value={editingCategory.description}
                      onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? 'bg-gray-600 text-white border-gray-500' 
                          : 'bg-white border-gray-300'
                      }`}
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={editingCategory.color}
                        onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <button
                        type="submit"
                        className="text-green-500 hover:text-green-600"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="text-gray-500 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <div>
                        <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {category.name}
                        </h3>
                        {category.description && (
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {category.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleShare(category)}
                        className="text-gray-400 hover:text-blue-500"
                        title="Share"
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="text-gray-400 hover:text-green-500"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-gray-400 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedCategory && (
            <ShareModal
              isOpen={showShareModal}
              onClose={() => setShowShareModal(false)}
              resourceType="category"
              resourceId={selectedCategory.id}
              resourceName={selectedCategory.name}
              currentSharedUsers={sharedUsers}
              onShare={shareResource}
              onUpdateAccess={updateAccess}
              onRemoveAccess={removeAccess}
              darkMode={darkMode}
            />
          )}
        </>
      )}
    </div>
  );
};

export default CategoryManager;