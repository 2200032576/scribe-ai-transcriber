'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDuration } from '@/lib/utils';

interface Session {
  id: string;
  title: string | null;
  duration: number;
  audioSource: string;
  status: string;
  transcript: string | null;
  summary: string | null;
  startTime: string;
  endTime: string | null;
  createdAt: string;
  audioUrl?: string;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${params.id}`);
        
        if (!response.ok) {
          throw new Error('Session not found');
        }

        const data = await response.json();
        
        // Debug logging
        console.log('=== SESSION DATA DEBUG ===');
        console.log('Full response:', data);
        console.log('Session object:', data.session);
        console.log('Transcript exists?', !!data.session?.transcript);
        console.log('Transcript length:', data.session?.transcript?.length || 0);
        console.log('Summary exists?', !!data.session?.summary);
        console.log('Summary length:', data.session?.summary?.length || 0);
        console.log('========================');
        
        setSession(data.session);
      } catch (err) {
        console.error('Session fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [params.id]);

  const generateTranscription = async () => {
    setIsTranscribing(true);
    setTranscriptionError(null);
    
    try {
      console.log('Starting transcription for session:', params.id);
      
      const response = await fetch(`/api/sessions/${params.id}/transcribe`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate transcription');
      }

      const data = await response.json();
      console.log('Transcription complete:', data);
      
      // Update the session data
      setSession(data.session);
      
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscriptionError(error instanceof Error ? error.message : 'Failed to generate transcription');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/sessions');
      } else {
        alert('Failed to delete session');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete session');
    }
  };

  const handleExport = () => {
    if (!session) return;

    const content = `
ScribeAI Recording Session
===========================

Title: ${session.title || 'Untitled Recording'}
Date: ${new Date(session.startTime).toLocaleString()}
Duration: ${formatDuration(session.duration)}
Audio Source: ${session.audioSource}
Status: ${session.status}

SUMMARY
=======
${session.summary || 'No summary available'}

FULL TRANSCRIPT
===============
${session.transcript || 'No transcription available'}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scribeai-session-${session.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">⚙️</div>
          <div className="text-white text-xl">Loading session...</div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-white mb-4">Session Not Found</h1>
          <p className="text-gray-300 mb-6">
            {error || 'This session does not exist or has been deleted.'}
          </p>
          <button
            onClick={() => router.push('/sessions')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            ← Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  const hasTranscript = session.transcript && session.transcript.length > 0;
  const hasSummary = session.summary && session.summary.length > 0;
  const needsTranscription = !hasTranscript && !hasSummary && session.status === 'completed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <nav className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-blue-400">ScribeAI</h1>
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
                Dashboard
              </a>
              <a href="/sessions" className="text-gray-300 hover:text-white transition-colors">
                Sessions
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/sessions')}
          className="text-gray-300 hover:text-white transition-colors mb-6 flex items-center gap-2"
        >
          <span>←</span> Back to Sessions
        </button>

        {/* Session Header Card */}
        <div className="bg-gray-800 rounded-xl shadow-xl p-6 mb-6 border border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-3">
                {session.title || 'Untitled Recording'}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-2">
                  📅 {new Date(session.startTime).toLocaleString()}
                </span>
                <span className="flex items-center gap-2">
                  ⏱️ {formatDuration(session.duration)}
                </span>
                <span className="flex items-center gap-2">
                  🎤 {session.audioSource}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  session.status === 'completed' 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                    : session.status === 'processing'
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {session.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExport}
                disabled={!hasTranscript}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                title={hasTranscript ? 'Export transcript' : 'No transcript to export'}
              >
                📥 Export
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>

        {/* Generate Transcript Button */}
        {needsTranscription && (
          <div className="bg-blue-900/20 border-2 border-blue-500/50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  ✨ Generate Transcript
                </h3>
                <p className="text-gray-300">
                  This recording is ready. Click the button to generate an AI-powered transcript and summary using Gemini.
                </p>
              </div>
              <button
                onClick={generateTranscription}
                disabled={isTranscribing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap shadow-lg hover:shadow-xl"
              >
                {isTranscribing ? (
                  <>
                    <span className="animate-spin text-xl">⚙️</span>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">🚀</span>
                    <span>Generate Now</span>
                  </>
                )}
              </button>
            </div>
            
            {transcriptionError && (
              <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">❌</span>
                  <div>
                    <p className="text-red-200 font-semibold mb-1">Transcription Failed</p>
                    <p className="text-red-300 text-sm">{transcriptionError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing Status */}
        {session.status === 'processing' && (
          <div className="bg-yellow-900/20 border-2 border-yellow-500/50 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-4xl animate-spin">⚙️</span>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Processing in Progress</h3>
                <p className="text-gray-300">
                  Your recording is being transcribed. This may take a few moments...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Section */}
        <div className="bg-gray-800 rounded-xl shadow-xl p-6 mb-6 border border-gray-700">
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📋</span> Summary
          </h3>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            {hasSummary ? (
              <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                {session.summary}
              </div>
            ) : (
              <div className="text-gray-500 italic text-center py-8">
                <div className="text-4xl mb-2">📝</div>
                <p>No summary available yet</p>
                {needsTranscription && (
                  <p className="text-sm mt-2">Generate a transcript to create a summary</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full Transcript Section */}
        <div className="bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700">
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📝</span> Full Transcript
          </h3>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 max-h-[600px] overflow-y-auto">
            {hasTranscript ? (
              <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                {session.transcript}
              </div>
            ) : (
              <div className="text-gray-500 italic text-center py-8">
                <div className="text-4xl mb-2">🎙️</div>
                <p>No transcript available yet</p>
                {needsTranscription && (
                  <p className="text-sm mt-2">Click the button above to generate a transcript</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}