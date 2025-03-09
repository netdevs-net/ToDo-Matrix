import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity } from 'lucide-react';
import type { ActivityLog } from '../../types';

interface ActivityFeedProps {
  activities: ActivityLog[];
  darkMode: boolean;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, darkMode }) => {
  const getActivityDescription = (activity: ActivityLog): string => {
    const actionMap = {
      create: 'created',
      update: 'updated',
      delete: 'deleted',
      complete: 'completed',
      comment: 'commented on',
      share: 'shared',
      archive: 'archived',
    };

    const resourceMap = {
      todo: 'task',
      quadrant: 'quadrant',
      comment: 'comment',
      workspace: 'workspace',
    };

    return `${actionMap[activity.action]} a ${resourceMap[activity.resourceType]}`;
  };

  return (
    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center mb-4">
        <Activity size={20} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
        <h3 className={`ml-2 text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Activity Feed
        </h3>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  {getActivityDescription(activity)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;