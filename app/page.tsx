import Link from 'next/link';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Welcome to <span className="text-blue-600">ScribeAI</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Transform your meetings into searchable, summarized transcripts with AI-powered audio transcription
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="bg-white hover:bg-gray-100 text-blue-600 font-bold py-3 px-8 rounded-lg text-lg border-2 border-blue-600 transition-colors"
            >
              Login
            </Link>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">🎤</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Real-time Transcription
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Get instant transcripts as you speak with advanced AI processing
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              AI Summaries
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Automatic meeting summaries with key points and action items
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">💾</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Searchable Archive
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Store and search all your transcripts in one place
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}