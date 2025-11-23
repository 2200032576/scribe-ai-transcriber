'use client';

import { AudioSource } from '@/hooks/useAudioRecorder';
import { formatDuration } from '@/lib/utils';

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioSource: AudioSource;
  status: string;
  onSourceChange: (source: AudioSource) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function RecordingControls({
  isRecording,
  isPaused,
  duration,
  audioSource,
  status,
  onSourceChange,
  onStart,
  onPause,
  onResume,
  onStop,
}: RecordingControlsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Recording Session
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Status: <span className="capitalize font-medium text-blue-600">{status}</span>
          </p>
        </div>
        
        <div className="text-4xl font-mono text-gray-900 dark:text-white">
          {formatDuration(duration)}
        </div>
      </div>

      {!isRecording && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select Audio Source
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onSourceChange('microphone')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                audioSource === 'microphone'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-2xl">🎤</span>
              <span className="font-medium">Microphone</span>
            </button>
            <button
              onClick={() => onSourceChange('tab')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                audioSource === 'tab'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-2xl">🖥️</span>
              <span className="font-medium">Tab Share</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {!isRecording ? (
          <button
            onClick={onStart}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl">▶️</span>
            Start Recording
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button
                onClick={onPause}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-xl">⏸️</span>
                Pause
              </button>
            ) : (
              <button
                onClick={onResume}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-xl">▶️</span>
                Resume
              </button>
            )}
            
            <button
              onClick={onStop}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">⏹️</span>
              Stop & Process
            </button>
          </>
        )}
      </div>
    </div>
  );
}