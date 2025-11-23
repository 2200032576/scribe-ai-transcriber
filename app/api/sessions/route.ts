import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { audioSource } = await req.json();

    // FIXED: Changed from prisma.session to prisma.recordingSession
    const newSession = await prisma.recordingSession.create({
      data: {
        userId: session.user.id,
        audioSource: audioSource || 'microphone',
        status: 'recording',
        title: `Recording ${new Date().toLocaleString()}`,
        startTime: new Date(), // Added this field
      },
    });

    return NextResponse.json({ sessionId: newSession.id });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIXED: Changed from prisma.session to prisma.recordingSession
    const sessions = await prisma.recordingSession.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        duration: true,
        audioSource: true,
        status: true,
        createdAt: true,
        startTime: true, // Added
        endTime: true,   // Added
        transcript: true,
        summary: true,
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Sessions fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}