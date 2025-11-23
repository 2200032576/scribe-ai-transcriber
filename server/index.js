require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

console.log('🔑 DEBUG: Environment Variables');
console.log('   GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('   GEMINI_API_KEY length:', process.env.GEMINI_API_KEY?.length || 0);
console.log('   GEMINI_API_KEY value:', process.env.GEMINI_API_KEY?.substring(0, 15) || 'MISSING');

const { createServer } = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { transcribeAudio, generateSummary } = require('./utils/gemini');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();
const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store active recording sessions
const activeRecordings = new Map();

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on('start-session', async (data) => {
    try {
      const { sessionId, source } = data;
      
      activeRecordings.set(socket.id, {
        sessionId,
        source,
        chunks: [],
        transcriptParts: [],
        startTime: Date.now()
      });

      socket.emit('status-update', { status: 'recording' });
      console.log(`🎙️ Recording started for session: ${sessionId} (source: ${source})`);
    } catch (error) {
      console.error('Error starting session:', error);
      socket.emit('error', { message: 'Failed to start recording' });
    }
  });

  socket.on('audio-chunk', async (data) => {
    try {
      const recording = activeRecordings.get(socket.id);
      if (!recording || recording.paused) {
        return;
      }

      const { sessionId, audioData, timestamp } = data;
      
      const audioBuffer = Buffer.from(audioData, 'base64');
      recording.chunks.push(audioBuffer);

      console.log(`📦 Received chunk ${recording.chunks.length} for ${sessionId} (${audioBuffer.length} bytes)`);

      // OPTIMIZED BATCHING: Transcribe every 30 chunks (~30 seconds) to reduce API calls
      // This reduces API calls by 3x while still providing periodic updates
      if (recording.source === 'tab' && recording.chunks.length % 30 === 0) {
        try {
          // Combine last 30 chunks for transcription
          const lastBatch = recording.chunks.slice(-30);
          const combinedAudio = Buffer.concat(lastBatch);
          
          console.log(`🎙️ Transcribing batch of 30 chunks (${combinedAudio.length} bytes)...`);
          
          const transcription = await transcribeAudio(combinedAudio, 'audio/webm');
          
          if (transcription && transcription.trim().length > 0) {
            recording.transcriptParts.push(transcription);

            socket.emit('transcript-chunk', {
              text: transcription,
              timestamp: timestamp
            });

            console.log(`✍️ Tab transcribed: ${transcription.substring(0, 60)}...`);
          }
        } catch (transcriptionError) {
          console.error('⚠️ Transcription error:', transcriptionError.message);
          // Don't crash - continue recording even if transcription fails
          socket.emit('transcript-error', { 
            message: 'Transcription temporarily unavailable due to rate limits'
          });
        }
      } else if (recording.source === 'microphone') {
        console.log(`🎤 Mic chunk stored (Web Speech API handles transcription)`);
      }

    } catch (error) {
      console.error('Error processing audio chunk:', error);
      socket.emit('error', { message: 'Failed to process audio chunk' });
    }
  });

  socket.on('pause-session', async (data) => {
    try {
      const recording = activeRecordings.get(socket.id);
      if (recording) {
        recording.paused = true;
        socket.emit('status-update', { status: 'paused' });
        console.log(`⏸️ Recording paused: ${recording.sessionId}`);
      }
    } catch (error) {
      console.error('Error pausing recording:', error);
    }
  });

  socket.on('resume-session', async (data) => {
    try {
      const recording = activeRecordings.get(socket.id);
      if (recording) {
        recording.paused = false;
        socket.emit('status-update', { status: 'recording' });
        console.log(`▶️ Recording resumed: ${recording.sessionId}`);
      }
    } catch (error) {
      console.error('Error resuming recording:', error);
    }
  });

  socket.on('stop-session', async (data) => {
    try {
      const recording = activeRecordings.get(socket.id);
      if (!recording) {
        socket.emit('error', { message: 'No active recording found' });
        return;
      }

      const { sessionId, duration } = data;

      socket.emit('status-update', { status: 'processing' });
      console.log(`⏹️ Stopping recording: ${sessionId}`);
      console.log(`   Total chunks received: ${recording.chunks.length}`);

      let audioFilePath = null;
      
      if (recording.chunks.length > 0) {
        try {
          const combinedAudio = Buffer.concat(recording.chunks);
          console.log(`💾 Combined audio size: ${(combinedAudio.length / 1024).toFixed(2)} KB`);
          
          if (combinedAudio.length < 1000) {
            console.warn('⚠️ WARNING: Audio file is very small, may be empty');
          }
          
          const audioDir = path.join(__dirname, '..', 'uploads', 'audio');
          const audioFileName = `${sessionId}.webm`;
          audioFilePath = path.join(audioDir, audioFileName);

          await fs.mkdir(audioDir, { recursive: true });
          await fs.writeFile(audioFilePath, combinedAudio);
          
          console.log(`💾 Audio file saved: ${audioFilePath}`);
          console.log(`   Size: ${(combinedAudio.length / 1024).toFixed(2)} KB`);
          
          const stats = await fs.stat(audioFilePath);
          console.log(`✅ File verified: ${(stats.size / 1024).toFixed(2)} KB`);
          
        } catch (fileError) {
          console.error('⚠️ Failed to save audio file:', fileError);
          audioFilePath = null;
        }
      } else {
        console.log('⚠️ No audio chunks to save');
      }

      // Transcribe any remaining chunks that weren't transcribed yet
      let fullTranscript = recording.transcriptParts.join('\n\n').trim();
      
      if (recording.source === 'tab' && recording.chunks.length % 30 !== 0 && recording.chunks.length > 0) {
        try {
          const remainingChunks = recording.chunks.slice(-(recording.chunks.length % 30));
          if (remainingChunks.length > 0) {
            console.log(`🎙️ Transcribing final ${remainingChunks.length} chunks...`);
            const combinedAudio = Buffer.concat(remainingChunks);
            const finalTranscription = await transcribeAudio(combinedAudio, 'audio/webm');
            
            if (finalTranscription && finalTranscription.trim().length > 0) {
              recording.transcriptParts.push(finalTranscription);
              fullTranscript = recording.transcriptParts.join('\n\n').trim();
            }
          }
        } catch (transcriptionError) {
          console.error('⚠️ Final transcription error:', transcriptionError.message);
        }
      }

      let summary = null;
      if (fullTranscript && fullTranscript.length > 50) {
        try {
          console.log('🤖 Generating summary...');
          summary = await generateSummary(fullTranscript);
          console.log('✅ Summary generated');
        } catch (summaryError) {
          console.error('⚠️ Summary generation error:', summaryError);
        }
      }

      await prisma.recordingSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          endTime: new Date(),
          audioFilePath: audioFilePath,
          transcript: fullTranscript.length > 0 ? fullTranscript : null,
          summary: summary,
          duration: duration
        }
      });

      console.log(`💾 Session saved:`, {
        sessionId,
        source: recording.source,
        hasAudioFile: !!audioFilePath,
        audioSize: recording.chunks.length > 0 ? Buffer.concat(recording.chunks).length : 0,
        chunksReceived: recording.chunks.length,
        hasTranscript: !!fullTranscript,
        transcriptLength: fullTranscript.length,
        hasSummary: !!summary
      });

      socket.emit('status-update', { status: 'completed' });
      socket.emit('session-complete', {
        sessionId: sessionId,
        transcript: fullTranscript || null,
        summary: summary || null
      });

      activeRecordings.delete(socket.id);
      console.log(`✅ Recording completed: ${sessionId}`);
    } catch (error) {
      console.error('💥 Error stopping recording:', error);
      socket.emit('error', { message: 'Failed to stop recording' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    activeRecordings.delete(socket.id);
  });
});

const PORT = process.env.SOCKET_PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
  console.log(`📡 CORS enabled for: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`);
});

process.on('SIGTERM', async () => {
  console.log('⚠️ SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n⚠️ SIGINT signal received: closing HTTP server');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});