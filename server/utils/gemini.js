const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('🔑 Loading Gemini API Key...');
console.log('   Key exists:', !!process.env.GEMINI_API_KEY);
console.log('   Key length:', process.env.GEMINI_API_KEY?.length || 0);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Rate limiting configuration
const RATE_LIMIT = {
  minDelayBetweenRequests: 5000, // 5 seconds minimum between API calls (very conservative)
  maxRetries: 3,
  lastRequestTime: 0
};

/**
 * Wait for rate limit cooldown
 */
async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - RATE_LIMIT.lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT.minDelayBetweenRequests) {
    const waitTime = RATE_LIMIT.minDelayBetweenRequests - timeSinceLastRequest;
    console.log(`⏳ Rate limit: waiting ${waitTime}ms before next request...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  RATE_LIMIT.lastRequestTime = Date.now();
}

/**
 * Parse retry delay from Gemini error
 */
function getRetryDelay(error) {
  try {
    const retryInfo = error.errorDetails?.find(
      d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
    );
    
    if (retryInfo?.retryDelay) {
      const delayStr = retryInfo.retryDelay.replace('s', '');
      const seconds = parseFloat(delayStr);
      return Math.ceil(seconds * 1000); // Convert to ms and round up
    }
  } catch (e) {
    console.error('Error parsing retry delay:', e);
  }
  
  return null;
}

/**
 * Transcribe audio chunk using Gemini 2.0 Flash Exp with retry logic
 * @param {Buffer} audioBuffer - Audio data buffer
 * @param {string} mimeType - Audio MIME type (e.g., 'audio/webm')
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Empty audio buffer received');
  }

  let lastError = null;
  
  for (let attempt = 0; attempt < RATE_LIMIT.maxRetries; attempt++) {
    try {
      console.log(`🎙️ Transcribing audio (attempt ${attempt + 1}/${RATE_LIMIT.maxRetries}): ${audioBuffer.length} bytes`);
      
      // Wait for rate limit before making request
      await waitForRateLimit();

      // Use Gemini 2.0 Flash Exp (only model that supports audio)
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp'
      });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBuffer.toString('base64')
          }
        },
        'Transcribe this audio accurately. Include speaker identification if multiple speakers are detected. Return only the transcription text without any preamble or explanation.'
      ]);

      const response = await result.response;
      const transcription = response.text();
      
      console.log(`✅ Transcription success: ${transcription.substring(0, 100)}...`);
      return transcription;
      
    } catch (error) {
      lastError = error;
      console.error(`💥 Gemini error (attempt ${attempt + 1}):`, error.message);
      
      // Handle rate limit errors (429)
      if (error.status === 429) {
        if (attempt < RATE_LIMIT.maxRetries - 1) {
          // Get retry delay from error or use exponential backoff
          const retryDelay = getRetryDelay(error) || Math.pow(2, attempt) * 5000;
          console.log(`⏳ Rate limited. Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Retry
        } else {
          throw new Error('Gemini API quota exceeded. Please wait a few minutes and try again.');
        }
      }
      
      // Handle model not found errors (404)
      if (error.status === 404 || error.message?.includes('not found')) {
        throw new Error('Gemini 2.0 Flash model not available. Your API key may not have access to this model.');
      }
      
      // Handle API key errors (don't retry)
      if (error.message?.includes('API key') || error.status === 401) {
        throw new Error('Invalid Gemini API key. Please check your .env.local file.');
      }
      
      // For other errors, don't retry
      break;
    }
  }
  
  throw new Error(`Failed to transcribe audio after ${RATE_LIMIT.maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Generate summary from full transcript
 * @param {string} transcript - Full transcript text
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummary(transcript) {
  try {
    console.log(`📊 Generating summary for transcript (${transcript.length} characters)...`);
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Empty transcript provided');
    }

    // Wait for rate limit before making request
    await waitForRateLimit();

    // Use Gemini 2.0 Flash for summary
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });

    const prompt = `Analyze this meeting transcript and provide a comprehensive summary with:

1. **Key Points**: Main topics discussed
2. **Action Items**: Tasks assigned with responsible parties
3. **Decisions Made**: Important decisions reached
4. **Next Steps**: Follow-up actions required

Transcript:
${transcript}

Format the summary in clear sections with bullet points.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    
    console.log(`✅ Summary generated: ${summary.substring(0, 100)}...`);
    return summary;
  } catch (error) {
    console.error('💥 Gemini summary error:', error);
    
    if (error.status === 429) {
      throw new Error('Gemini API quota exceeded. Summary will be generated later.');
    }
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      throw new Error('Gemini model not available.');
    }
    if (error.message?.includes('API key')) {
      throw new Error('Invalid Gemini API key.');
    }
    
    throw new Error(`Failed to generate summary: ${error.message}`);
  }
}

module.exports = {
  transcribeAudio,
  generateSummary
};