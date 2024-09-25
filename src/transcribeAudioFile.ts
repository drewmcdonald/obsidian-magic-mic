import OpenAI, { toFile } from 'openai';
import { encode, decode } from 'gpt-tokenizer';
import audioDataToWavChunks from './utils/audioDataToWavChunks';

export interface TranscriptionOptions {
  prompt: string;
  audioData: ArrayBuffer;
  onChunkStart?: (i: number, totalChunks: number) => void;
}

// 25MB limit for audio files, per
// https://platform.openai.com/docs/guides/speech-to-text
const MAX_CHUNK_SIZE = 25 * 1024 * 1024;
// https://platform.openai.com/docs/guides/speech-to-text/prompting
const WHISPER_TOKEN_LIMIT = 224;

/**
 * Transcribe an audio file with OpenAI's Whisper model
 *
 * Handles splitting the file into chunks, processing each chunk, and
 * concatenating the results.
 */
export default async function transcribeAudioFile(
  client: OpenAI,
  { prompt, audioData, onChunkStart }: TranscriptionOptions,
): Promise<string> {
  const chunks = await audioDataToWavChunks(audioData, MAX_CHUNK_SIZE);

  let transcript = '';
  for (const [i, chunk] of chunks.entries()) {
    if (onChunkStart) onChunkStart(i, chunks.length);
    const file = await toFile(chunk, fileName(i, 'wav'));
    const res = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      prompt: mixBasePromptAndTranscript(prompt, transcript),
    });
    const sep = i === 0 ? '' : ' ';
    transcript += sep + res.text.trim();
  }
  return transcript;
}

function fileName(i: number, extension: string): string {
  return `audio_${i.toString().padStart(3, '0')}.${extension}`;
}

/**
 * Returns the base prompt concatenated with up to (224 - promptLength) tokens of
 * context from the transcription thus far.
 */
function mixBasePromptAndTranscript(
  basePrompt: string,
  transcript: string,
): string {
  if (transcript.length === 0) return basePrompt;

  const promptTokens = encode(basePrompt + ' … '); // some delineation, I guess :shrug:
  const transcriptTokens = encode(transcript);
  const availableTokens = WHISPER_TOKEN_LIMIT - promptTokens.length;
  return decode(promptTokens.concat(transcriptTokens.slice(-availableTokens)));
}
