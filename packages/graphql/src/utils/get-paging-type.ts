import { PagingType } from "../enums";
import { type ConnectionArgsInterface } from "../interfaces";

export function getPagingType(
  connectionArgs: ConnectionArgsInterface<any, any>
): PagingType {
  const { first, last, after, before } = connectionArgs;
  const isForwardPaging =
    typeof first === "number" || typeof after === "string";
  const isBackwardPaging =
    typeof last === "number" || typeof before === "string";

  if (isForwardPaging && isBackwardPaging) {
    if (
      (isForwardPaging && before != null) ||
      (isBackwardPaging && after != null)
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
