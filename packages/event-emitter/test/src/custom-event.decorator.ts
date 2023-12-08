import { SetMetadata } from "@nestjs/common";

import { OnEventMetadata } from "../../src";
import { EVENT_LISTENER_METADATA } from "../../src/constants";
import type { OnEventOptions } from "../../src/interfaces";

export const CustomEvent = (event: string, options?: OnEventOptions) =>
  SetMetadata(EVENT_LISTENER_METADATA, {
    event,
    options,
  } as OnEventMetadata);
