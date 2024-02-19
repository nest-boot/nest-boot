import { InjectQueue, Queue } from "../../src";
import { TEST_QUEUE_NAME, TEST_REQUEST_SCOPED_QUEUE_NAME } from "./constants";

export class PublishService {
  constructor(
    public readonly defaultQueue: Queue,
    @InjectQueue(TEST_QUEUE_NAME)
    public readonly testQueue: Queue,
    @InjectQueue(TEST_REQUEST_SCOPED_QUEUE_NAME)
    public readonly testRequestScopedQueue: Queue,
  ) {}
}
