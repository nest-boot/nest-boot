import type { ModuleMetadata } from "@nestjs/common";
import { Test } from "@nestjs/testing";

/**
 * Creates a queue transport test module without database or API providers.
 * @param metadata - Providers and imports under test.
 * @returns Test builder with quiet transport logging.
 */
export function createQueueTestingModule(metadata: ModuleMetadata) {
  return Test.createTestingModule(metadata).setLogger({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
}
