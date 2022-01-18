import { TimeInfo } from "./time-info.interface";

export interface QueueMetrics {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  isPaused: boolean;
  responseTime: TimeInfo;
  processTime: TimeInfo;
}
