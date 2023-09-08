import { SetMetadata } from "@nestjs/common";

import { SUBSCRIBE_METADATA_KEY } from "./event-emitter.module-definition";

export const Subscribe = (eventName: string): MethodDecorator =>
  SetMetadata(SUBSCRIBE_METADATA_KEY, eventName);

export const OnEvent = Subscribe;
