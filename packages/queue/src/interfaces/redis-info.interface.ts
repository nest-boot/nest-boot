/* eslint-disable camelcase */
export interface RedisInfo {
  used_memory_human: string;
  redis_version: string;
  redis_mode: string;
  total_system_memory_human: string;
  // 占用内存峰值
  used_memory_peak_human: string;
  // 占用内存比例峰值
  used_memory_peak_perc: string;
}
