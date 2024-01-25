import { tokens as bracketTokens } from "./brackets";
import { Comma } from "./Comma";
import { tokens as comparatorTokens } from "./comparators";
import { tokens as connectiveTokens } from "./connectives";
import { tokens as fieldTokens } from "./fields";
import { Identifier } from "./Identifier";
import { UnquotedLiteral } from "./UnquotedLiteral";
import { tokens as valueTokens } from "./values";
import { WhiteSpace } from "./WhiteSpace";

export const tokens = [
  // 比较符
  ...comparatorTokens,
  // 连接符
  ...connectiveTokens,
  // 括号
  ...bracketTokens,
  // 逗号
  Comma,
  // 字段
  ...fieldTokens,
  // 值
  ...valueTokens,
  // 公共
  Identifier,
  UnquotedLiteral,
  WhiteSpace,
];
