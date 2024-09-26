import OpenAI from 'openai';
import { encode, decode } from 'gpt-tokenizer';
import { FileLike } from 'openai/uploads';

export interface TranscriptionOptions {
  prompt: string;
  audioFiles: FileLike[];
  onChunkStart?: (i: number, totalChunks: number) => void;
}

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
  { prompt, audioFiles, onChunkStart }: TranscriptionOptions,
): Promise<string> {
  let transcript = '';
  for (const [i, file] of audioFiles.entries()) {
    if (onChunkStart) onChunkStart(i, audioFiles.length);
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
