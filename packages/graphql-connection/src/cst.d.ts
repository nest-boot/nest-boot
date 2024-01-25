import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface QueryCstNode extends CstNode {
  name: "query";
  children: QueryCstChildren;
}

export interface QueryCstChildren {
  orQuery: OrQueryCstNode[];
}

export interface OrQueryCstNode extends CstNode {
  name: "orQuery";
  children: OrQueryCstChildren;
}

export interface OrQueryCstChildren {
  andQuery: AndQueryCstNode[];
  Or?: IToken[];
}

export interface AndQueryCstNode extends CstNode {
  name: "andQuery";
  children: AndQueryCstChildren;
}

export interface AndQueryCstChildren {
  atomicQuery: AtomicQueryCstNode[];
  And?: IToken[];
}

export interface AtomicQueryCstNode extends CstNode {
  name: "atomicQuery";
  children: AtomicQueryCstChildren;
}

export interface AtomicQueryCstChildren {
  subQuery?: SubQueryCstNode[];
  notQuery?: NotQueryCstNode[];
  term?: TermCstNode[];
}

export interface SubQueryCstNode extends CstNode {
  name: "subQuery";
  children: SubQueryCstChildren;
}

export interface SubQueryCstChildren {
  LeftBracket: IToken[];
  query: QueryCstNode[];
  RightBracket: IToken[];
}

export interface NotQueryCstNode extends CstNode {
  name: "notQuery";
  children: NotQueryCstChildren;
}

export interface NotQueryCstChildren {
  Not: IToken[];
  atomicQuery: AtomicQueryCstNode[];
}

export interface TermCstNode extends CstNode {
  name: "term";
  children: TermCstChildren;
}

export interface TermCstChildren {
  equalFieldTerm?: EqualFieldTermCstNode[];
  otherFieldTerm?: OtherFieldTermCstNode[];
  globalTerm?: GlobalTermCstNode[];
}

export interface EqualFieldTermCstNode extends CstNode {
  name: "equalFieldTerm";
  children: EqualFieldTermCstChildren;
}

export interface EqualFieldTermCstChildren {
  field: FieldCstNode[];
  Equal: IToken[];
  value: ValueCstNode[];
  Comma?: IToken[];
}

export interface OtherFieldTermCstNode extends CstNode {
  name: "otherFieldTerm";
  children: OtherFieldTermCstChildren;
}

export interface OtherFieldTermCstChildren {
  field: FieldCstNode[];
  LessThan?: IToken[];
  LessThanOrEqual?: IToken[];
  GreaterThan?: IToken[];
  GreaterThanOrEqual?: IToken[];
  value: ValueCstNode[];
}

export interface GlobalTermCstNode extends CstNode {
  name: "globalTerm";
  children: GlobalTermCstChildren;
}

export interface GlobalTermCstChildren {
  value: ValueCstNode[];
}

export interface FieldCstNode extends CstNode {
  name: "field";
  children: FieldCstChildren;
}

export interface FieldCstChildren {
  Field: IToken[];
}

export interface ValueCstNode extends CstNode {
  name: "value";
  children: ValueCstChildren;
}

export interface ValueCstChildren {
  Value: IToken[];
}

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  query(children: QueryCstChildren, param?: IN): OUT;
  orQuery(children: OrQueryCstChildren, param?: IN): OUT;
  andQuery(children: AndQueryCstChildren, param?: IN): OUT;
  atomicQuery(children: AtomicQueryCstChildren, param?: IN): OUT;
  subQuery(children: SubQueryCstChildren, param?: IN): OUT;
  notQuery(children: NotQueryCstChildren, param?: IN): OUT;
  term(children: TermCstChildren, param?: IN): OUT;
  equalFieldTerm(children: EqualFieldTermCstChildren, param?: IN): OUT;
  otherFieldTerm(children: OtherFieldTermCstChildren, param?: IN): OUT;
  globalTerm(children: GlobalTermCstChildren, param?: IN): OUT;
  field(children: FieldCstChildren, param?: IN): OUT;
  value(children: ValueCstChildren, param?: IN): OUT;
}
