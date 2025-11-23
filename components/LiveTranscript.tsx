'use client';

import { formatDuration } from '@/lib/utils';
import { useEffect, useRef } from 'react';

interface TranscriptChunk {
  text: string;
  timestamp: number;
}

interface LiveTranscriptProps {
  chunks: TranscriptChunk[];
}

export default function LiveTranscript({ chunks }: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chunks]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Live Transcript
      </h3>
      
      <div
        ref={scrollRef}
        className="space-y-3 max-h-96 overflow-y-auto pr-2"
      >
        {chunks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎙️</div>
            <p className="text-gray-500 dark:text-gray-400">
              Transcript will appear here as you record...
            </p>
          </div>
        ) : (
          chunks.map((chunk, idx) => (
            <div
              key={idx}
              className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-r"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-mono">
                {formatDuration(chunk.timestamp)}
              </p>
              <p className="text-gray-900 dark:text-white leading-relaxed">
                {chunk.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}