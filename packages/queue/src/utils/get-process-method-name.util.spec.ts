import type { ProcessMethodName } from "../interfaces/job-name.interface.js";
import {
  assertUniqueProcessMethods,
  getProcessMethodName,
} from "./get-process-method-name.util.js";

it.each([
  ["send", "processSend"],
  ["sendEmail", "processSendEmail"],
  ["send-email", "processSendEmail"],
  ["send-many-emails", "processSendManyEmails"],
])("maps %s to %s", (job, method) => {
  expect(getProcessMethodName(job)).toBe(method);
  expectTypeOf<
    ProcessMethodName<"send-email">
  >().toEqualTypeOf<"processSendEmail">();
});

it("rejects collisions and names mapping to the reserved dispatcher", () => {
  expect(() => {
    assertUniqueProcessMethods(["send", "welcome"]);
  }).not.toThrow();
  expect(() => {
    assertUniqueProcessMethods(["send-email", "sendEmail"]);
  }).toThrow("both map to processSendEmail");
  expect(() => {
    assertUniqueProcessMethods(["sendEmail", "send-email"]);
  }).toThrow("both map to processSendEmail");
  expect(() => {
    assertUniqueProcessMethods(["---"]);
  }).toThrow("reserved process method");
});
