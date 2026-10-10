/** Interface for entities that have an `id` primary key. */
export interface IdEntity<ID = number | string | bigint> {
  /** The entity's primary key. */
  id: ID;
}
