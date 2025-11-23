'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAudioRecorder, AudioSource } from '@/hooks/useAudioRecorder';
import RecordingControls from '@/components/RecordingControls';
import LiveTranscript from '@/components/LiveTranscript';

interface TranscriptChunk {
  text: string;
  timestamp: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>('');
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [audioSource, setAudioSource] = useState<AudioSource>('microphone');
  const [error, setError] = useState<string>('');

  const {
    isRecording,
    isPaused,
    duration,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useAudioRecorder({
    sessionId,
    onTranscriptChunk: (text, timestamp) => {
      setTranscriptChunks(prev => [...prev, { text, timestamp }]);
    },
    onStatusChange: (newStatus) => {
      setStatus(newStatus);
      
      if (newStatus === 'completed') {
        setTimeout(() => {
          router.push(`/sessions/${sessionId}`);
        }, 2000);
      }
    },
    onError: (errorMsg) => {
      setError(errorMsg);
      setTimeout(() => setError(''), 5000);
    },
  });

  const handleStart = async () => {
    try {
      setError('');
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioSource }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const { sessionId: newSessionId } = await response.json();
      setSessionId(newSessionId);
      setTranscriptChunks([]);
      
      await startRecording(audioSource);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Recording Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Start a new recording session with AI-powered transcription
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            <p className="font-medium">Error: {error}</p>
          </div>
        )}

        {status === 'processing' && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg">
            <p className="font-medium">Processing your recording and generating summary...</p>
          </div>
        )}

        {status === 'completed' && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-400 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
            <p className="font-medium">✓ Recording completed! Redirecting to session details...</p>
          </div>
        )}

        <RecordingControls
          isRecording={isRecording}
          isPaused={isPaused}
          duration={duration}
          audioSource={audioSource}
          status={status}
          onSourceChange={setAudioSource}
          onStart={handleStart}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
        />

        <div className="mt-6">
          <LiveTranscript chunks={transcriptChunks} />
        </div>
      </div>
    </div>
  );
}