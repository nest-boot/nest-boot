import { BaseQueue, Queue } from "@nest-boot/queue";

import { isQueueVisible, QueueVisible } from "./queue-visible.decorator.js";

it("requires an explicit visibility marker on each concrete queue class", () => {
  @QueueVisible()
  @Queue()
  class VisibleQueue extends BaseQueue {}

  @Queue()
  @QueueVisible()
  class ReversedQueue extends BaseQueue {}

  @Queue()
  class HiddenQueue extends BaseQueue {}

  @Queue()
  class ChildQueue extends VisibleQueue {}

  for (const target of [VisibleQueue, ReversedQueue]) {
    expect(isQueueVisible(Object.create(target.prototype) as BaseQueue)).toBe(
      true,
    );
  }
  for (const target of [HiddenQueue, ChildQueue]) {
    expect(isQueueVisible(Object.create(target.prototype) as BaseQueue)).toBe(
      false,
    );
  }
});
