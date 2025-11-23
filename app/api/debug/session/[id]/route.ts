import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/debug/session/[id]
 * Debug endpoint to check raw session data
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await prisma.recordingSession.findUnique({
      where: { id }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      title: session.title,
      status: session.status,
      hasTranscript: !!session.transcript,
      transcriptLength: session.transcript?.length || 0,
      transcriptPreview: session.transcript?.substring(0, 200) || null,
      transcriptFull: session.transcript,
      hasSummary: !!session.summary,
      summaryLength: session.summary?.length || 0,
      summaryPreview: session.summary?.substring(0, 200) || null,
      summaryFull: session.summary,
      audioUrl: session.audioUrl,
      createdAt: session.createdAt
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
