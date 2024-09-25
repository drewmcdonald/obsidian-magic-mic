import { must } from './must';

export default class Timer {
  startTime: Date | null = null;
  elapsedSeconds = 0;
  private bankedSeconds = 0;
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    this.startTime = new Date();
    this.intervalId = setInterval(() => {
      this.elapsedSeconds =
        this.bankedSeconds +
        (new Date().getTime() - must(this.startTime).getTime()) / 1000;
    }, 100); // Update every tenth of a second
  }

  pause() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.startTime = null;
    this.intervalId = null;
    this.bankedSeconds = this.elapsedSeconds;
  }
}
