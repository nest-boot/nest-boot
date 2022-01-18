export interface JobInfo {
  id: string;
  name: string;
  data: unknown;
  opts: any;
  timestamp: number;
  finishedOn?: number;
  processedOn?: number;
  waited?: number;
  run?: number;
}
