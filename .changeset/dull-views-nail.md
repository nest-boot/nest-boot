---
"@nest-boot/logger": patch
---

feat: 日志默认屏蔽请求头的 authorization 和 cookie 字段，非生产环境可以在请求头添加 x-logging: false 来关闭日志。
