import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ScribeAI - AI-Powered Meeting Transcription',
  description: 'Real-time audio transcription for meetings and recordings',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar user={session?.user} />
        {children}
      </body>
    </html>
  );
}