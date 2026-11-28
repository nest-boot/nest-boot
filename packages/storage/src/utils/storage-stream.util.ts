import { Readable } from "node:stream";

import { type PutObjectCommandInput } from "@aws-sdk/client-s3";
import { BadRequestException } from "@nestjs/common";

import { type StorageFileData } from "../interfaces/storage-file-options.interface.js";

/**
 * Formats an inclusive HTTP `Range` header value, or returns `undefined` when unbounded.
 * @param start - Inclusive starting byte offset.
 * @param end - Inclusive ending byte offset.
 * @returns Formatted `bytes=start-end` header string, or `undefined`.
 */
export function byteRange(start?: number, end?: number): string | undefined {
  for (const [name, offset] of [
    ["start", start],
    ["end", end],
  ] as const) {
    if (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0)) {
      throw new RangeError(
        `Storage stream ${name} must be a non-negative integer`,
      );
    }
  }

  const resolvedStart = start ?? (end === undefined ? undefined : 0);
  if (resolvedStart === undefined) {
    return undefined;
  }
  if (end !== undefined && end < resolvedStart) {
    throw new RangeError("Storage stream end must not be less than start");
  }

  return `bytes=${String(resolvedStart)}-${end === undefined ? "" : String(end)}`;
}

/**
 * Creates an `AbortController` linked to an optional upstream `AbortSignal` and optional timeout.
 * @param signal - Upstream abort signal to forward.
 * @param timeoutMs - Optional timeout duration in milliseconds before aborting.
 * @param timeoutReason - Reason passed to `controller.abort()` when the timeout fires.
 * @returns Linked controller and a listener/timer cleanup callback.
 */
export function linkedAbortController(
  signal?: AbortSignal,
  timeoutMs?: number,
  timeoutReason?: unknown,
): {
  controller: AbortController;
  dispose: () => void;
} {
  const controller = new AbortController();
  const abort = () => {
    controller.abort(signal?.reason);
  };

  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener("abort", abort, { once: true });
  }

  const timer =
    timeoutMs !== undefined && !controller.signal.aborted
      ? setTimeout(() => {
          controller.abort(timeoutReason);
        }, timeoutMs)
      : undefined;
  timer?.unref();

  return {
    controller,
    dispose: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      signal?.removeEventListener("abort", abort);
    },
  };
}

/**
 * Peeks the first non-empty byte chunk from a stream and puts it back via `unshift`,
 * rejecting with `BadRequestException` if the stream ends empty.
 * @param stream - Readable stream to inspect.
 * @returns The same readable stream positioned at its first byte.
 */
export async function ensureNonEmptyStream(
  stream: Readable,
): Promise<Readable> {
  if (stream.errored) {
    throw asError(stream.errored);
  }
  if (stream.destroyed) {
    throw new BadRequestException("External file download aborted");
  }

  return await new Promise<Readable>((resolve, reject) => {
    const cleanup = () => {
      stream.off("readable", onReadable);
      stream.off("end", onEnd);
      stream.off("error", onError);
      stream.off("close", onClose);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onEnd = () => {
      cleanup();
      reject(new BadRequestException("External file must not be empty"));
    };
    const onClose = () => {
      cleanup();
      reject(new BadRequestException("External file download aborted"));
    };
    const onReadable = () => {
      let chunk: unknown = stream.read();
      while (chunk !== null) {
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : typeof chunk === "string"
            ? Buffer.from(chunk)
            : arrayBufferView(chunk as NodeJS.ArrayBufferView);
        if (buf.byteLength > 0) {
          if (stream.listenerCount("error") <= 1) {
            // Keep an error listener registered across the async handoff to Upload
            // so buffered stream errors stay on `stream.errored` without crashing Node.
            stream.on("error", noopStreamErrorListener);
          }
          cleanup();
          stream.unshift(buf);
          resolve(stream);
          return;
        }
        chunk = stream.read();
      }
      if (stream.readableEnded) {
        onEnd();
      }
    };

    stream.on("readable", onReadable);
    stream.once("end", onEnd);
    stream.once("error", onError);
    stream.once("close", onClose);
    onReadable();
  });
}

/**
 * Prevents unhandled stream `'error'` crashes while keeping `stream.errored` intact for consumers.
 */
function noopStreamErrorListener(): void {
  // Intentionally empty: prevents unhandled 'error' events while preserving `stream.errored`.
}

/**
 * Converts supported file data inputs into an S3 `PutObject` body.
 * @param data - String, buffer view, iterable, or async iterable upload data.
 * @param encoding - Optional character encoding for string inputs.
 * @returns Buffer or Readable body accepted by `@aws-sdk/lib-storage`.
 */
export function uploadBody(
  data: StorageFileData,
  encoding?: BufferEncoding,
): PutObjectCommandInput["Body"] {
  if (typeof data === "string") {
    return Buffer.from(data, encoding);
  }
  if (ArrayBuffer.isView(data)) {
    return arrayBufferView(data);
  }
  if (
    data instanceof Readable &&
    !data.readableObjectMode &&
    encoding === undefined
  ) {
    return data;
  }

  return Readable.from(uploadChunks(data, encoding), { objectMode: false });
}

/**
 * Coerces an arbitrary thrown value into an `Error` instance.
 * @param error - Thrown value to normalize.
 * @returns Original `Error` or a new `Error(String(error))`.
 */
export function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Converts iterable upload data into non-empty byte chunks.
 * @yields {Buffer} Each non-empty upload chunk encoded as bytes.
 * @param data - Iterable or async iterable of strings or buffer views.
 * @param encoding - Optional text encoding for string chunks.
 * @returns Async generator of Buffer chunks.
 */
async function* uploadChunks(
  data:
    | Iterable<string | NodeJS.ArrayBufferView>
    | AsyncIterable<string | NodeJS.ArrayBufferView>,
  encoding?: BufferEncoding,
): AsyncGenerator<Buffer> {
  for await (const chunk of data) {
    const buffer =
      typeof chunk === "string"
        ? Buffer.from(chunk, encoding)
        : arrayBufferView(chunk);
    if (buffer.byteLength > 0) {
      yield buffer;
    }
  }
}

/**
 * Creates a `Buffer` view restricted to the input view's exact byte slice.
 * @param data - TypedArray or DataView slice.
 * @returns Buffer covering `[byteOffset, byteOffset + byteLength)`.
 */
function arrayBufferView(data: NodeJS.ArrayBufferView): Buffer {
  return Buffer.from(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  );
}
