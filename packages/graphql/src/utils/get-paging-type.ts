import { PagingType } from "../enums";
import { ConnectionArgsInterface } from "../interfaces";

export function getPagingType(
  connectionArgs: ConnectionArgsInterface<any, any>
): PagingType {
  const { first, last, after, before } = connectionArgs;
  const isForwardPaging =
    typeof first !== "undefined" || typeof after !== "undefined";
  const isBackwardPaging =
    typeof last !== "undefined" || typeof before !== "undefined";

  if (isForwardPaging && isBackwardPaging) {
    if (
      (isForwardPaging && typeof before !== "undefined") ||
      (isBackwardPaging && typeof after !== "undefined")
    ) {
      throw new Error("paging must use either first/after or last/before");
    } else {
      throw new Error(
        "cursor-based pagination cannot be forwards AND backwards"
      );
    }
  }

  return isBackwardPaging ? PagingType.BACKWARD : PagingType.FORWARD;
}
