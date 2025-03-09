import React from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Statistics as StatsType, QuadrantType } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface StatisticsProps {
  stats: StatsType;
  darkMode: boolean;
}

const Statistics: React.FC<StatisticsProps> = ({ stats, darkMode }) => {
  const quadrantLabels = {
    urgentImportant: 'Urgent & Important',
    importantNotUrgent: 'Important, Not Urgent',
    urgentNotImportant: 'Urgent, Not Important',
    notUrgentNotImportant: 'Not Urgent, Not Important',
  };

  const quadrantColors = {
    urgentImportant: 'rgba(239, 68, 68, 0.7)',
    importantNotUrgent: 'rgba(59, 130, 246, 0.7)',
    urgentNotImportant: 'rgba(245, 158, 11, 0.7)',
    notUrgentNotImportant: 'rgba(156, 163, 175, 0.7)',
  };

  const quadrantBorderColors = {
    urgentImportant: 'rgb(239, 68, 68)',
    importantNotUrgent: 'rgb(59, 130, 246)',
    urgentNotImportant: 'rgb(245, 158, 11)',
    notUrgentNotImportant: 'rgb(156, 163, 175)',
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  const taskDistributionData = {
    labels: Object.keys(stats.quadrants).map(q => quadrantLabels[q as QuadrantType]),
    datasets: [
      {
        label: 'Number of Tasks',
        data: Object.values(stats.quadrants).map(q => q.total),
        backgroundColor: Object.keys(stats.quadrants).map(q => quadrantColors[q as QuadrantType]),
        borderColor: Object.keys(stats.quadrants).map(q => quadrantBorderColors[q as QuadrantType]),
        borderWidth: 1,
      },
    ],
  };

  const completionRateData = {
    labels: Object.keys(stats.quadrants).map(q => quadrantLabels[q as QuadrantType]),
    datasets: [
      {
        label: 'Completion Rate',
        data: Object.values(stats.quadrants).map(q => q.total > 0 ? (q.completed / q.total) * 100 : 0),
        backgroundColor: Object.keys(stats.quadrants).map(q => quadrantColors[q as QuadrantType]),
        borderColor: Object.keys(stats.quadrants).map(q => quadrantBorderColors[q as QuadrantType]),
        borderWidth: 1,
      },
    ],
  };

  const timeSpentData = {
    labels: Object.keys(stats.quadrants).map(q => quadrantLabels[q as QuadrantType]),
    datasets: [
      {
        label: 'Time Spent',
        data: Object.values(stats.quadrants).map(q => q.timeSpent / (1000 * 60)), // Convert to minutes
        backgroundColor: Object.keys(stats.quadrants).map(q => quadrantColors[q as QuadrantType]),
        borderColor: Object.keys(stats.quadrants).map(q => quadrantBorderColors[q as QuadrantType]),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: darkMode ? 'white' : 'black',
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.raw;
            if (context.dataset.label === 'Time Spent') {
              return `${label}: ${Math.round(value)} minutes`;
            } else if (context.dataset.label === 'Completion Rate') {
              return `${label}: ${value.toFixed(1)}%`;
            }
            return `${label}: ${value}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
        },
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        ticks: {
          color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
        },
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: darkMode ? 'white' : 'black',
        },
      },
    },
  };

  return (
    <div className={`p-6 rounded-lg shadow-md ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
      <h2 className="text-xl font-bold mb-4">Task Statistics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tasks</h3>
          <p className="text-2xl font-bold">{stats.totalTasks}</p>
        </div>
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed Tasks</h3>
          <p className="text-2xl font-bold">{stats.completedTasks}</p>
        </div>
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Completion Rate</h3>
          <p className="text-2xl font-bold">
            {stats.totalTasks > 0 ? `${((stats.completedTasks / stats.totalTasks) * 100).toFixed(1)}%` : '0%'}
          </p>
        </div>
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Time Spent</h3>
          <p className="text-2xl font-bold">{formatTime(stats.totalTimeSpent)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-lg font-semibold mb-2">Task Distribution</h3>
          <div className="h-64">
            <Bar options={options} data={taskDistributionData} />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Time Spent (minutes)</h3>
          <div className="h-64">
            <Bar options={options} data={timeSpentData} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-2">Completion Rate (%)</h3>
          <div className="h-64">
            <Bar options={options} data={completionRateData} />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Time Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <Doughnut 
              options={doughnutOptions} 
              data={{
                labels: Object.keys(stats.quadrants).map(q => quadrantLabels[q as QuadrantType]),
                datasets: [
                  {
                    data: Object.values(stats.quadrants).map(q => q.timeSpent),
                    backgroundColor: Object.keys(stats.quadrants).map(q => quadrantColors[q as QuadrantType]),
                    borderColor: Object.keys(stats.quadrants).map(q => quadrantBorderColors[q as QuadrantType]),
                    borderWidth: 1,
                  },
                ],
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;