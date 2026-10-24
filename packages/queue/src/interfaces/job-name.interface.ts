/** Converts hyphen-separated job names to their handler suffix. */
export type JobPascalCase<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? `${Capitalize<Head>}${JobPascalCase<Tail>}`
    : Capitalize<S>;

/** Runtime method name corresponding to one job name. */
export type ProcessMethodName<S extends string> = `process${JobPascalCase<S>}`;

type Conflicts<Names extends string, N extends Names> = {
  [Other in Exclude<
    Names,
    N
  >]: ProcessMethodName<Other> extends ProcessMethodName<N> ? Other : never;
}[Exclude<Names, N>];

/** Collision diagnostics are part of the Queue decorator's class constraint. */
export type JobNameContract<Names extends string> = [
  {
    [N in Names]: [Conflicts<Names, N>] extends [never]
      ? never
      : `Jobs "${N}" and "${Conflicts<Names, N>}" both map to ${ProcessMethodName<N>}`;
  }[Names],
] extends [never]
  ? unknown
  : {
      readonly "Conflicting job handler names": {
        [N in Names]: [Conflicts<Names, N>] extends [never]
          ? never
          : `Jobs "${N}" and "${Conflicts<Names, N>}" both map to ${ProcessMethodName<N>}`;
      }[Names];
    };
