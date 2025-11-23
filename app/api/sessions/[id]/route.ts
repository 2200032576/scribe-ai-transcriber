import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

/**
 * GET /api/sessions/[id]
 * Get a specific session by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user) {
      console.log('❌ No user session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('👤 User ID:', session.user.id);

    const { id } = await params;
    console.log('🔍 Looking for session ID:', id);

    const recordingSession = await prisma.recordingSession.findUnique({
      where: { id: id },
      include: {
        chunks: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    console.log('📋 Found session:', recordingSession ? 'YES ✅' : 'NO ❌');
    
    if (recordingSession) {
      console.log('   Session details:', {
        id: recordingSession.id,
        userId: recordingSession.userId,
        status: recordingSession.status,
        hasTranscript: !!recordingSession.transcript,
        transcriptLength: recordingSession.transcript?.length || 0,
        transcriptPreview: recordingSession.transcript?.substring(0, 50) || 'NULL',
        hasSummary: !!recordingSession.summary,
        summaryLength: recordingSession.summary?.length || 0,
        summaryPreview: recordingSession.summary?.substring(0, 50) || 'NULL'
      });
    } else {
      // Check if session exists at all
      const allSessions = await prisma.recordingSession.findMany({
        select: { id: true, userId: true },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
      console.log('📊 Recent sessions in DB:', allSessions);
    }

    if (!recordingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    console.log('✅ Returning session data');
    return NextResponse.json({ session: recordingSession });
  } catch (error) {
    console.error('💥 Session fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]
 * Delete a specific session
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.log('🗑️ Deleting session ID:', id);

    const recordingSession = await prisma.recordingSession.findUnique({
      where: { id: id }
    });

    if (!recordingSession) {
      console.log('❌ Session not found for deletion');
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    await prisma.recordingSession.delete({
      where: { id: id }
    });

    console.log('✅ Session deleted successfully');
    return NextResponse.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('💥 Session delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sessions/[id]
 * Update a session
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    console.log('📝 Updating session ID:', id);

    const recordingSession = await prisma.recordingSession.findUnique({
      where: { id: id }
    });

    if (!recordingSession) {
      console.log('❌ Session not found for update');
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.recordingSession.update({
      where: { id: id },
      data: body
    });

    console.log('✅ Session updated successfully');
    return NextResponse.json({ success: true, session: updated });
  } catch (error) {
    console.error('💥 Session update error:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}