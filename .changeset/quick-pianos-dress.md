---
"@nest-boot/auth": minor
---

认证守卫移除数据库相关代码，移动到请求上下文中间件中实现，防止在 GraphQL 下重复查询数据库。
