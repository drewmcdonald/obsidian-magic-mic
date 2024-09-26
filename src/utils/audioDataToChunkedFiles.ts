import { toFile } from 'openai';
import { FileLike } from 'openai/uploads';

/**
 * Split an audio file into chunks of a maximum size and re-encode them as WAV
 * files.
 *
 * This could use some work to become more efficient - re-encoding to WAV means
 * the output is never compressed, so we're pushing less audio data into the
 * Whisper API for every chunk.
 *
 *   * TODO: Consider down-sampling the audio and converting it to mono to save
 *     space
 *   * TODO: Consider a more efficient format than WAV
 *
 */
export default async function audioDataToChunkedFiles(
  audioData: ArrayBuffer,
  maxSize: number,
): Promise<FileLike[]> {
  const audioContext = new window.AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(audioData);

  const { sampleRate, numberOfChannels, length } = audioBuffer;

  // Calculate chunk size in terms of samples (maxSize is in bytes)
  const bytesPerSample = 4; // 32-bit float = 4 bytes
  const chunkSamples = Math.floor(
    maxSize / (numberOfChannels * bytesPerSample),
  );
  const nChunks = Math.ceil(length / chunkSamples);

  const files: FileLike[] = [];

  for (let i = 0; i < nChunks; i++) {
    const startSample = i * chunkSamples;
    const endSample = Math.min((i + 1) * chunkSamples, length);

    // Create a new empty AudioBuffer for each chunk
    const chunkBuffer = audioContext.createBuffer(
      numberOfChannels,
      endSample - startSample,
      sampleRate,
    );

    // Copy each channel's data from the original AudioBuffer
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const chunkData = chunkBuffer.getChannelData(channel);
      const originalData = audioBuffer.getChannelData(channel);
      chunkData.set(originalData.slice(startSample, endSample));
    }

    // Convert the chunk to a WAV ArrayBuffer
    const wavArrayBuffer = audioBufferToWav(chunkBuffer);
    const file = await toFile(wavArrayBuffer, fileName(i, 'wav'));

    files.push(file);
  }

  return files;
}

// Look, I'm not gonna pretend ChatGPT didn't write this
export function audioBufferToWav(buffer: AudioBuffer) {
  const numOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numOfChannels * 2; // 16-bit PCM data
  const wavBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(wavBuffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numOfChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChannels * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChannels * 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Write interleaved PCM samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numOfChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i] * 0x7fff; // Convert to 16-bit PCM
      view.setInt16(offset, sample < 0 ? sample : sample, true);
      offset += 2;
    }
  }

  return wavBuffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function fileName(i: number, extension: string): string {
  return `audio_${i.toString().padStart(3, '0')}.${extension}`;
}
