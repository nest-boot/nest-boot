export interface JobInfo {
  id: string;
  name: string;
  data: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: any;
  timestamp: number;
  finishedOn?: number;
  processedOn?: number;
  waited?: number;
  run?: number;
}
