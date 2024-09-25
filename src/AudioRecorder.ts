import { moment } from 'obsidian';

import {
  mimeTypeToFileExtension,
  pickMimeType,
  SupportedMimeType,
} from './utils/mimeType';
import { must } from './utils/must';
import Timer from './utils/Timer';

export interface RecorderOptions {
  bitRate?: number;
  preferredMimeType?: SupportedMimeType;
}

export default class AudioRecorder {
  /** The time at which recording originally began */
  startedAt: moment.Moment | null = null;
  timer: Timer;

  private mimeType: SupportedMimeType;
  private bitRate: number;

  private mediaRecorder: MediaRecorder | null = null;
  private data: BlobPart[] = [];

  constructor(opts: RecorderOptions = {}) {
    this.mimeType = pickMimeType(
      opts.preferredMimeType ?? 'audio/webm; codecs=opus',
    );
    this.bitRate = opts.bitRate ?? 32000;
  }

  get fileExtension() {
    return mimeTypeToFileExtension(this.mimeType);
  }

  get state(): RecordingState {
    return this.mediaRecorder?.state ?? 'inactive';
  }

  get elapsedSeconds() {
    return this.timer.elapsedSeconds;
  }

  private setupMediaRecorder(stream: MediaStream) {
    const rec = new MediaRecorder(stream, {
      mimeType: this.mimeType,
      audioBitsPerSecond: this.bitRate,
    });
    rec.ondataavailable = (e) => this.data.push(e.data);
    rec.onerror = (e) => console.error('Error recording audio:', e);
    rec.onpause = () => this.timer.pause();
    rec.onresume = () => this.timer.start();
    rec.onstart = () => {
      this.timer = new Timer();
      this.timer.start();
    };

    return rec;
  }

  start() {
    if (this.startedAt === null) {
      this.startedAt = moment().local();
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        this.mediaRecorder = this.setupMediaRecorder(stream);
        this.mediaRecorder.start();
      })
      .catch((err) => {
        console.error('Error accessing microphone:', err);
      });
  }

  pause() {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      console.error('Cannot pause: not currently recording');
      return;
    }
    this.mediaRecorder.pause();
  }

  resume() {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'paused') {
      console.error('Cannot resume: not currently paused');
      return;
    }
    this.mediaRecorder.resume();
  }

  stop() {
    return new Promise<Blob>((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        throw new Error('Cannot stop: not currently recording');
      }

      this.mediaRecorder.onstop = () => {
        this.timer.pause();

        must(this.mediaRecorder)
          .stream.getTracks()
          .forEach((track) => track.stop()); // stop the stream tracks

        const blob = new Blob(this.data, { type: this.mimeType });

        this.data = []; // reset the data
        this.mediaRecorder = null; // reset the recorder

        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }
}
