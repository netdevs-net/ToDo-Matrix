import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Send, Edit2, Trash2 } from 'lucide-react';
import type { Comment, User } from '../../types';

interface CommentListProps {
  comments: Comment[];
  currentUser: User;
  onAddComment: (content: string) => void;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  darkMode: boolean;
}

const CommentList: React.FC<CommentListProps> = ({
  comments,
  currentUser,
  onAddComment,
  onEditComment,
  onDeleteComment,
  darkMode,
}) => {
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment('');
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = (commentId: string) => {
    if (editContent.trim()) {
      onEditComment(commentId, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  };

  return (
    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center mb-4">
        <MessageSquare size={20} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
        <h3 className={`ml-2 text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Comments
        </h3>
      </div>

      <div className="space-y-4 mb-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`p-3 rounded-lg ${
              darkMode ? 'bg-gray-700' : 'bg-gray-50'
            }`}
          >
            {editingId === comment.id ? (
              <div className="flex">
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={`flex-grow p-2 text-sm rounded-md mr-2 ${
                    darkMode
                      ? 'bg-gray-600 text-white border-gray-500'
                      : 'bg-white border-gray-300'
                  }`}
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(comment.id)}
                  className="text-green-500 hover:text-green-600"
                >
                  <Send size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    {comment.content}
                  </p>
                  {comment.userId === currentUser.id && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(comment)}
                        className="text-blue-500 hover:text-blue-600"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteComment(comment.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                  {comment.editedAt && ' (edited)'}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className={`flex-grow p-2 text-sm rounded-md ${
            darkMode
              ? 'bg-gray-700 text-white border-gray-600'
              : 'bg-white border-gray-300'
          }`}
        />
        <button
          type="submit"
          disabled={!newComment.trim()}
          className={`px-4 py-2 rounded-md text-white ${
            newComment.trim()
              ? 'bg-blue-500 hover:bg-blue-600'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default CommentList;