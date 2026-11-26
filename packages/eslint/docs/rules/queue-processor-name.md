# nest-boot/queue-processor-name

📝 Require a processor class name to match its declared queue class.

💼 This rule is enabled in the ✅ `recommended` config.

💭 This rule requires [type information](https://typescript-eslint.io/linting/typed-linting).

<!-- end auto-generated rule header -->

要求 `@Processor(SomeQueue)` 装饰的队列消费者类命名为对应的 `<Name>Processor`（去掉队列类名末尾的 `Queue` 后拼接 `Processor`）。

## Examples

### Incorrect

```ts
import { Processor } from "@nest-boot/queue";

class EmailQueue {}

@Processor(EmailQueue)
export class SmsProcessor {}
```

### Correct

```ts
import { Processor } from "@nest-boot/queue";

class EmailQueue {}

@Processor(EmailQueue)
export class EmailProcessor {}
```
