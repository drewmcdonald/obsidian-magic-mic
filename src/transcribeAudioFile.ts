import OpenAI, { toFile } from 'openai';
import { encode, decode } from 'gpt-tokenizer';

export interface TranscriptionOptions {
	prompt: string;
	audioData: ArrayBuffer;
	extension: string;
	onChunkStart?: (i: number, totalChunks: number) => void;
}

/**
 * Transcribe an audio file with OpenAI's Whisper model
 *
 * Handles splitting the file into chunks, processing each chunk, and
 * concatenating the results.
 */
export default async function transcribeAudioFile(
	client: OpenAI,
	{ prompt, audioData, extension, onChunkStart }: TranscriptionOptions,
): Promise<string> {
	const chunks = chunkArrayBufferEvenly(audioData, MAX_CHUNK_SIZE);

	let transcript = '';
	for (const [i, chunk] of chunks.entries()) {
		if (onChunkStart) onChunkStart(i, chunks.length);
		const file = await toFile(chunk, fileName(i, extension));
		const res = await client.audio.transcriptions.create({
			model: 'whisper-1',
			file,
			prompt:
				i === 0 ? undefined : mixBasePromptAndTranscript(prompt, transcript),
		});
		const sep = i === 0 ? '' : ' ';
		transcript += sep + res.text.trim();
	}
	return transcript;
}

function fileName(i: number, extension: string): string {
	return `audio_${i.toString().padStart(3, '0')}.${extension}`;
}

// 25MB limit for audio files, per
// https://platform.openai.com/docs/guides/speech-to-text
const MAX_CHUNK_SIZE = 25 * 1024 * 1024;

/**
 * Split an ArrayBuffer into approximately even chunks up to a maximum size.
 */
function chunkArrayBufferEvenly(
	arrayBuffer: ArrayBuffer,
	maxSize: number,
): ArrayBuffer[] {
	const len = arrayBuffer.byteLength;
	const numChunks = Math.ceil(len / maxSize); // Calculate the number of chunks required
	const chunkSize = Math.ceil(len / numChunks); // Optimal chunk size to distribute chunks evenly

	const result = [];
	let start = 0;

	while (start < len) {
		const end = Math.min(start + chunkSize, len);
		const chunk = arrayBuffer.slice(start, end);
		result.push(chunk);
		start = end;
	}

	return result;
}

const WHISPER_TOKEN_LIMIT = 224; // https://platform.openai.com/docs/guides/speech-to-text/prompting

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
