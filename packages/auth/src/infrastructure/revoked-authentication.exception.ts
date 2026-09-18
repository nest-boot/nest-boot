import { ForbiddenException } from "@nestjs/common";

/** Signals a committed credential revocation even though the operation is rejected. @internal */
export class RevokedAuthenticationException extends ForbiddenException {}
