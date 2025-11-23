import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * POST /api/sessions/[id]/transcribe
 * Generate transcript and summary for a recording session using Gemini
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.log('🎙️ Starting transcription for session:', id);

    const recordingSession = await prisma.recordingSession.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!recordingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (recordingSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (!recordingSession.audioFilePath) {
      return NextResponse.json(
        { error: 'No audio file found for this session' },
        { status: 400 }
      );
    }

    // Update status to processing
    await prisma.recordingSession.update({
      where: { id },
      data: { status: 'processing' }
    });

    try {
      console.log('📥 Reading audio file from:', recordingSession.audioFilePath);
      
      // Check if file exists
      try {
        await fs.access(recordingSession.audioFilePath);
      } catch (error) {
        console.error('❌ Audio file not found on disk');
        throw new Error('Audio file not found on server');
      }

      const audioBuffer = await fs.readFile(recordingSession.audioFilePath);
      const audioBase64 = audioBuffer.toString('base64');
      
      console.log('📝 Transcribing audio with Gemini...');
      console.log('   File size:', (audioBuffer.length / 1024 / 1024).toFixed(2), 'MB');
      
      if (audioBuffer.length < 1000) {
        throw new Error('Audio file is too small or corrupted');
      }
      
      // CRITICAL: Use gemini-2.0-flash-exp for audio transcription
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const transcriptionPrompt = `Please transcribe the following audio recording accurately. 
Provide only the transcription text, without any additional commentary or formatting.`;

      let transcription = '';
      let transcriptionError = null;

      try {
        const transcriptionResult = await model.generateContent([
          {
            inlineData: {
              mimeType: 'audio/webm',
              data: audioBase64
            }
          },
          { text: transcriptionPrompt }
        ]);

        transcription = transcriptionResult.response.text();
        console.log('✅ Transcription complete');
        console.log('   Length:', transcription.length, 'characters');
      } catch (error: any) {
        console.error('💥 Transcription failed:', error.message);
        transcriptionError = error;
        
        // Check if it's a quota error
        if (error.status === 429 || error.message?.includes('quota')) {
          transcription = 'Transcription unavailable: API quota exceeded. Please try again later or wait for quota reset.';
        } else {
          transcription = `Transcription failed: ${error.message || 'Unknown error'}`;
        }
      }

      let summary = null;

      // Only generate summary if transcription succeeded
      if (transcription && transcription.length > 50 && !transcriptionError) {
        try {
          console.log('📄 Generating summary with Gemini...');
          const summaryModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
          
          const summaryPrompt = `Please create a comprehensive summary of this meeting transcript. 
Include:
- Main topics discussed
- Key points and important details
- Decisions made
- Action items (if any)
- Overall conclusion

Format your summary with clear sections and bullet points where appropriate.

Transcript:
${transcription}`;

          const summaryResult = await summaryModel.generateContent(summaryPrompt);
          summary = summaryResult.response.text();
          
          console.log('✅ Summary generated');
        } catch (summaryError: any) {
          console.error('💥 Summary generation failed:', summaryError.message);
          
          if (summaryError.status === 429 || summaryError.message?.includes('quota')) {
            summary = 'Summary unavailable: API quota exceeded. The transcript is available above.';
          } else {
            summary = 'Summary generation failed. Please review the transcript manually.';
          }
        }
      } else if (transcriptionError) {
        summary = 'Summary unavailable because transcription failed.';
      }

      // Update session with results
      const updatedSession = await prisma.recordingSession.update({
        where: { id },
        data: {
          transcript: transcription,
          summary: summary,
          status: transcriptionError ? 'failed' : 'completed'
        },
        include: {
          chunks: {
            orderBy: { timestamp: 'asc' }
          }
        }
      });

      console.log('✅ Session updated successfully');

      return NextResponse.json({
        success: true,
        session: updatedSession,
        warning: transcriptionError ? 'Transcription completed with API quota warnings' : null
      });

    } catch (transcriptionError) {
      console.error('💥 Transcription error:', transcriptionError);
      
      // Update status to failed
      await prisma.recordingSession.update({
        where: { id },
        data: { 
          status: 'failed',
          transcript: 'Transcription failed. Please check server logs.',
          summary: null
        }
      });

      return NextResponse.json(
        { 
          error: 'Failed to transcribe audio', 
          details: transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('💥 Transcription endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to process transcription request' },
      { status: 500 }
    );
  }
}