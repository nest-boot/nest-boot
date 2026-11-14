# @nest-boot/command

## 8.1.0

### Minor Changes

- 783c5cd: Use space-separated paths for all built-in CLI commands. Run database commands
  as `nb database create`, `nb database migration create`,
  `nb database schema update`, or `nb database seeder run`, and start queue
  consumers with `nb queue start`. Update existing scripts to separate command
  words with spaces; colon-separated command paths are no longer registered.
  
  Entering a valid command prefix, such as `nb database` or
  `nb database migration`, now lists matching subcommands and exits successfully
  without executing any of them. Existing complete command paths retain priority.
