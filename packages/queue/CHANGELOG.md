# @nest-boot/queue

## 6.12.0

### Minor Changes

- fc7a9f8: 请求上下文添加 type 字段

### Patch Changes

- Updated dependencies [fc7a9f8]
  - @nest-boot/request-context@6.11.0

## 6.11.5

### Patch Changes

- 8372590: 更新依赖
- Updated dependencies [8372590]
  - @nest-boot/request-context@6.10.1
  - @nest-boot/common@6.10.1

## 6.11.4

### Patch Changes

- b30b169: 可重复任务不自动生成 jobId，解决重复创建可重复任务的问题。

## 6.11.3

### Patch Changes

- 0cca7f7: 修复队列处理器和消费者返回值没有正确的记录到数据库中

## 6.11.2

### Patch Changes

- 1b42159: 修复 em.fork 和 returnValue 问题

## 6.11.1

### Patch Changes

- 1f11da5: 修复 em.fork 问题，数据库作业表添加 result 和 value

## 6.11.0

### Minor Changes

- 0444d44: 使用数据库保存作业

### Patch Changes

- 9e39734: 使用 UUID 作为队列作业的默认 ID

## 6.10.1

### Patch Changes

- c1cb714: 修复作业执行成功但判断队列失败
