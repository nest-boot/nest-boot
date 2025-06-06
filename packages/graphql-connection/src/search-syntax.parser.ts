import { CstParser } from "chevrotain";

import { tokens } from "./tokens";
import { LeftBracket, RightBracket } from "./tokens/brackets";
import { Comma } from "./tokens/Comma";
import {
  Equal,
  GreaterThan,
  GreaterThanOrEqual,
  LessThan,
  LessThanOrEqual,
} from "./tokens/comparators";
import { And, Not, Or } from "./tokens/connectives";
import { Field } from "./tokens/fields";
import { Value } from "./tokens/values";

export class SearchSyntaxParser extends CstParser {
  [key: string]: any;

  constructor() {
    super(tokens);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const $ = this;

    $.RULE("query", () => {
      $.SUBRULE($.orQuery);
    });

    $.RULE("orQuery", () => {
      $.SUBRULE1($.andQuery);

      $.MANY(() => {
        $.CONSUME(Or);
        $.SUBRULE2($.andQuery);
      });
    });

    $.RULE("andQuery", () => {
      $.SUBRULE1($.atomicQuery);

      $.MANY(() => {
        $.OPTION(() => $.CONSUME(And));
        $.SUBRULE2($.atomicQuery);
      });
    });

    $.RULE("atomicQuery", () => {
      $.OR([
        { ALT: () => $.SUBRULE($.subQuery) },
        { ALT: () => $.SUBRULE($.notQuery) },
        { ALT: () => $.SUBRULE($.term) },
      ]);
    });

    $.RULE("subQuery", () => {
      $.CONSUME(LeftBracket);
      $.SUBRULE($.query);
      $.CONSUME(RightBracket);
    });

    $.RULE("notQuery", () => {
      $.CONSUME(Not);
      $.SUBRULE($.atomicQuery);
    });

    $.RULE("term", () => {
      $.OR([
        { ALT: () => $.SUBRULE($.equalFieldTerm) },
        { ALT: () => $.SUBRULE($.otherFieldTerm) },
        { ALT: () => $.SUBRULE($.globalTerm) },
      ]);
    });

    $.RULE("equalFieldTerm", () => {
      $.SUBRULE($.field);
      $.CONSUME(Equal);
      $.AT_LEAST_ONE_SEP({
        SEP: Comma,
        DEF: () => {
          $.SUBRULE($.value);
        },
      });
    });

    $.RULE("otherFieldTerm", () => {
      $.SUBRULE($.field);
      $.OR([
        { ALT: () => $.CONSUME(LessThan) },
        { ALT: () => $.CONSUME(LessThanOrEqual) },
        { ALT: () => $.CONSUME(GreaterThan) },
        { ALT: () => $.CONSUME(GreaterThanOrEqual) },
      ]);
      $.SUBRULE($.value);
    });

    $.RULE("globalTerm", () => {
      $.SUBRULE($.value);
    });

    $.RULE("field", () => {
      $.CONSUME(Field);
    });

    $.RULE("value", () => {
      $.CONSUME(Value);
    });

    this.performSelfAnalysis();
  }
}

export const searchSyntaxParser = new SearchSyntaxParser();
