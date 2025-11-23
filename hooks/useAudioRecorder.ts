import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export type AudioSource = 'microphone' | 'tab';

interface UseAudioRecorderProps {
  sessionId: string;
  onTranscriptChunk?: (text: string, timestamp: number) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
}

export function useAudioRecorder({
  sessionId,
  onTranscriptChunk,
  onStatusChange,
  onError,
}: UseAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentSource, setCurrentSource] = useState<AudioSource | null>(null);
  
  // MediaRecorder for saving audio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Web Speech API for live transcription (microphone only)
  const recognitionRef = useRef<any>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Initialize Socket.io
  const initSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
        transports: ['websocket'],
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Socket connected');
      });

      socketRef.current.on('status-update', ({ status }) => {
        console.log('📊 Status update:', status);
        onStatusChange?.(status);
      });

      socketRef.current.on('transcript-chunk', ({ text, timestamp }) => {
        // Server-side transcription from Gemini (works for both mic and tab)
        console.log('📝 Server transcript:', text);
        onTranscriptChunk?.(text, timestamp);
      });

      socketRef.current.on('error', ({ message }) => {
        console.error('❌ Socket error:', message);
        onError?.(message);
      });

      socketRef.current.on('session-complete', ({ transcript, summary }) => {
        console.log('✅ Session completed');
      });
    }
  }, [onStatusChange, onError, onTranscriptChunk]);

  // Initialize Web Speech API for live transcription (MICROPHONE ONLY)
  const initSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('⚠️ Speech recognition not supported - live transcription disabled');
      return null;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript;
        const timestamp = Date.now() - startTimeRef.current;
        onTranscriptChunk?.(transcript, timestamp);
        console.log('🎤 Live mic transcript:', transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('⚠️ Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Restart recognition if no speech detected
        if (isRecording && !isPaused && currentSource === 'microphone') {
          try {
            recognition.start();
          } catch (e) {
            // Ignore if already started
          }
        }
      }
    };

    recognition.onend = () => {
      // Auto-restart if still recording from microphone
      if (isRecording && !isPaused && currentSource === 'microphone') {
        try {
          recognition.start();
        } catch (error) {
          console.error('Error restarting recognition:', error);
        }
      }
    };

    return recognition;
  }, [isRecording, isPaused, currentSource, onTranscriptChunk]);

  // Start microphone
  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      console.log('🎤 Microphone access granted');
      return stream;
    } catch (error) {
      console.error('❌ Microphone error:', error);
      throw new Error('Microphone access denied. Please allow microphone permission.');
    }
  }, []);

  // Start tab share
  const startTabShare = useCallback(async () => {
    try {
      // Request display media with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required for getDisplayMedia API
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        } as MediaTrackConstraints,
      });

      // Check if audio track exists
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        // Stop video track before throwing error
        stream.getVideoTracks().forEach(track => track.stop());
        throw new Error('No audio track found. Please select a tab with audio and check "Share audio" in the dialog.');
      }

      console.log('🖥️ Tab audio capture started:', audioTracks[0].label);
      
      // Remove video track (we only need audio for our use case)
      stream.getVideoTracks().forEach(track => {
        track.stop();
        console.log('🎬 Video track stopped (not needed)');
      });
      
      return stream;
    } catch (error) {
      console.error('❌ Tab share error:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Tab share cancelled. Please allow screen sharing and check "Share audio".');
        }
        if (error.message.includes('No audio track')) {
          throw error; // Re-throw our custom error
        }
      }
      throw new Error('Failed to capture tab audio. Make sure to check "Share audio" in the browser dialog.');
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async (source: AudioSource) => {
    try {
      console.log(`🎬 Starting ${source} recording...`);
      initSocket();

      const stream = source === 'microphone' 
        ? await startMicrophone() 
        : await startTabShare();
      
      streamRef.current = stream;
      setCurrentSource(source);

      // === 1. START MEDIARECORDER (for saving audio + server transcription) ===
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle audio data - send to server for transcription
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current?.connected) {
          // Convert blob to base64 and send to server
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            const audioData = base64data.split(',')[1];
            
            socketRef.current?.emit('audio-chunk', {
              sessionId,
              audioData,
              timestamp: Date.now() - startTimeRef.current,
            });
            
            console.log('📤 Sent audio chunk:', event.data.size, 'bytes');
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
        onError?.('Recording error occurred');
      };

      // Start recording - capture chunks every 1 second
      mediaRecorder.start(1000);
      console.log('🎙️ MediaRecorder started');

      // === 2. START WEB SPEECH API (ONLY FOR MICROPHONE) ===
      if (source === 'microphone') {
        // Enable live client-side transcription for microphone
        const recognition = initSpeechRecognition();
        if (recognition) {
          recognitionRef.current = recognition;
          try {
            recognition.start();
            console.log('🎤 Live transcription started (Web Speech API)');
            onStatusChange?.('recording-with-live-transcript');
          } catch (error) {
            console.warn('⚠️ Live transcription unavailable:', error);
            onStatusChange?.('recording');
          }
        } else {
          onStatusChange?.('recording');
        }
      } else {
        // Tab share: only server-side transcription available
        console.log('🖥️ Tab share mode: Using server-side Gemini transcription only');
        onStatusChange?.('recording-tab-audio');
      }

      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Start duration counter
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Notify server that session started
      socketRef.current?.emit('start-session', { sessionId, source });
      console.log(`✅ ${source} recording session started`);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start recording';
      console.error('❌ Start recording error:', message);
      onError?.(message);
      throw error;
    }
  }, [initSocket, sessionId, startMicrophone, startTabShare, initSpeechRecognition, onError, onStatusChange]);

  // Pause
  const pauseRecording = useCallback(() => {
    if (isRecording && !isPaused) {
      // Pause MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
        console.log('⏸️ MediaRecorder paused');
      }
      
      // Stop speech recognition (only if microphone mode)
      if (recognitionRef.current && currentSource === 'microphone') {
        recognitionRef.current.stop();
        console.log('⏸️ Speech recognition paused');
      }
      
      setIsPaused(true);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      socketRef.current?.emit('pause-session', { sessionId });
      console.log('⏸️ Recording paused');
    }
  }, [isRecording, isPaused, sessionId, currentSource]);

  // Resume
  const resumeRecording = useCallback(() => {
    if (isPaused) {
      // Resume MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        console.log('▶️ MediaRecorder resumed');
      }
      
      // Restart speech recognition (only if microphone mode)
      if (currentSource === 'microphone') {
        const recognition = initSpeechRecognition();
        if (recognition) {
          recognitionRef.current = recognition;
          try {
            recognition.start();
            console.log('▶️ Speech recognition resumed');
          } catch (e) {
            console.warn('Could not restart speech recognition:', e);
          }
        }
      }
      
      setIsPaused(false);
      
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      socketRef.current?.emit('resume-session', { sessionId });
      console.log('▶️ Recording resumed');
    }
  }, [isPaused, sessionId, currentSource, initSpeechRecognition]);

  // Stop
  const stopRecording = useCallback(() => {
    console.log('⏹️ Stopping recording...');
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      console.log('⏹️ MediaRecorder stopped');
    }
    
    // Stop speech recognition (if active)
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      console.log('⏹️ Speech recognition stopped');
    }
    
    setIsRecording(false);
    setIsPaused(false);
    setCurrentSource(null);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Stop all audio tracks
    streamRef.current?.getTracks().forEach(track => {
      track.stop();
      console.log('🛑 Audio track stopped');
    });
    
    // Notify server to stop and process
    socketRef.current?.emit('stop-session', { 
      sessionId,
      duration,
    });
    
    console.log('✅ Recording stopped, duration:', duration, 'seconds');
  }, [sessionId, duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
      socketRef.current?.disconnect();
    };
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    currentSource,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}