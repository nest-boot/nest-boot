import type { Transaction } from "@mikro-orm/core";
import type { AbstractSqlConnection } from "@mikro-orm/sql";
import { RequestContext } from "@nest-boot/request-context";

import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "./row-level-security.js";
import { RowLevelSecurityExecutor } from "./row-level-security-executor.js";

describe.each([true, false])(
  "RowLevelSecurityExecutor (batched setup: %s)",
  (supportsMultipleStatements) => {
    it.each(["outside", "empty", "disabled"])(
      "does not reset a clean transaction for an %s context",
      async (mode) => {
        const { executor, executeQuery, transactional } = createExecutor();
        const transaction: Transaction = {};
        const query = () =>
          executor.execute("select 1", [], "all", transaction);

        if (mode === "outside") {
          await query();
        } else {
          await RequestContext.run(new RequestContext({ type: "test" }), () => {
            if (mode === "disabled") {
              RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
            }
            return query();
          });
        }

        expect(executeQuery).toHaveBeenCalledExactlyOnceWith(
          "select 1",
          [],
          "all",
          transaction,
          undefined,
        );
        expect(transactional).not.toHaveBeenCalled();
      },
    );

    it.each(["setup", "query"])(
      "releases queued queries after %s fails",
      async (failurePhase) => {
        const { executor, executeQuery } = createExecutor();
        const transaction: Transaction = {};
        const started = createBarrier();
        const finish = createBarrier();
        const failure = new Error(`${failurePhase} failed`);

        if (failurePhase === "query") {
          executeQuery.mockResolvedValueOnce([]);
        }
        executeQuery.mockImplementationOnce(async () => {
          started.resolve();
          await finish.promise;
          throw failure;
        });

        const scopedQuery = (role: string, sql: string) =>
          RequestContext.run(new RequestContext({ type: "test" }), () => {
            RowLevelSecurity.setRole(role);
            return executor.execute(sql, [], "all", transaction);
          });
        const first = scopedQuery("first_role", "select first");
        const rejected = expect(first).rejects.toBe(failure);
        await started.promise;

        const second = scopedQuery("second_role", "select second");
        const third = scopedQuery("third_role", "select third");
        await Promise.resolve();
        expect(executeQuery).toHaveBeenCalledTimes(
          failurePhase === "setup" ? 1 : 2,
        );

        finish.resolve();
        await rejected;
        await expect(Promise.all([second, third])).resolves.toEqual([[], []]);
        expect(executeQuery.mock.calls.map(([sql]) => sql)).toEqual([
          "SET LOCAL ROLE first_role;",
          ...(failurePhase === "query" ? ["select first"] : []),
          "SET LOCAL ROLE second_role;",
          "select second",
          "SET LOCAL ROLE third_role;",
          "select third",
        ]);

        await scopedQuery("third_role", "select again");
        expect(executeQuery.mock.calls.at(-1)).toEqual([
          "select again",
          [],
          "all",
          transaction,
          undefined,
        ]);
      },
    );

    function createExecutor() {
      const executeQuery = vi
        .fn<AbstractSqlConnection["execute"]>()
        .mockResolvedValue([]);
      const transactional = vi
        .fn<() => Promise<never>>()
        .mockRejectedValue(new Error("Unexpected nested transaction"));
      return {
        executor: new RowLevelSecurityExecutor(
          { transactional },
          executeQuery as AbstractSqlConnection["execute"],
          supportsMultipleStatements,
        ),
        executeQuery,
        transactional,
      };
    }
  },
);

function createBarrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
