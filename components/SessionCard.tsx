'use client';

import Link from 'next/link';
import { formatDate, formatDuration } from '@/lib/utils';

interface SessionCardProps {
  session: {
    id: string;
    title: string | null;
    duration: number;
    audioSource: string;
    status: string;
    createdAt: Date;
    transcript: string | null;
  };
  onDelete: (id: string) => void;
}

export default function SessionCard({ session, onDelete }: SessionCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'recording':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {session.title || 'Untitled Session'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(new Date(session.createdAt))}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
            session.status
          )}`}
        >
          {session.status}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <span>{session.audioSource === 'microphone' ? '🎤' : '🖥️'}</span>
          <span className="capitalize">{session.audioSource}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>⏱️</span>
          <span>{formatDuration(session.duration)}</span>
        </div>
      </div>

      {session.transcript && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {session.transcript}
        </p>
      )}

      <div className="flex gap-2">
        <Link
          href={`/sessions/${session.id}`}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-md text-sm font-medium transition-colors"
        >
          View Details
        </Link>
        <button
          onClick={() => onDelete(session.id)}
          className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}