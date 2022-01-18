import { JobInfo } from "./job-info.interface";

export interface Jobs {
  page: number;
  pageSize: number;
  total: number;
  jobs: JobInfo[];
}
