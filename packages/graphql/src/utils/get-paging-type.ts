import { QueryConnectionArgs } from "../dtos/query-connection.args";
import { PagingType } from "../enums";

export function getPagingType(connectionArgs: QueryConnectionArgs): PagingType {
  const { first, last, after, before } = connectionArgs;
  const isForwardPaging = !!first || !!after;
  const isBackwardPaging = !!last || !!before;

  if (isForwardPaging && isBackwardPaging) {
    if ((isForwardPaging && before) || (isBackwardPaging && after)) {
      throw new Error("paging must use either first/after or last/before");
    } else {
      throw new Error(
        "cursor-based pagination cannot be forwards AND backwards"
      );
    }
  }

  return isBackwardPaging ? PagingType.BACKWARD : PagingType.FORWARD;
}
