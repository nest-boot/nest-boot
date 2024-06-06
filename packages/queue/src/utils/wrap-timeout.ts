import { Job, ProcessorFunction } from "../interfaces";

export function wrapTimeout(
  processor: ProcessorFunction,
): (job: Job) => Promise<void> {
  return async (job: Job) => {
    let timer: NodeJS.Timeout | undefined;

    const [result] = await Promise.race([
      (async () => {
        const result = await processor(job);

        clearTimeout(timer);

        return result;
      })(),
      ...(typeof job.opts.timeout !== "undefined"
        ? [
            new Promise<void>((resolve, reject) => {
              timer = setTimeout(() => {
                reject(new Error("Job processing timeout"));
              }, job.opts.timeout);
            }),
          ]
        : []),
    ]);

    return result;
  };
}
