/**
 * Represents a cursor for cursor-based pagination in GraphQL connections.
 *
 * Cursors are encoded as base64 JSON strings containing the position information
 * needed for pagination. They typically include the entity ID and optionally
 * the value of the field being sorted by.
 *
 * @example Creating a cursor from an object
 * ```typescript
 * const cursor = new Cursor({ id: '123', value: 'some-value' });
 * console.log(cursor.toString()); // Base64 encoded string
 * ```
 *
 * @example Parsing a cursor string
 * ```typescript
 * const cursor = new Cursor('eyJpZCI6IjEyMyJ9');
 * console.log(cursor.id); // '123'
 * ```
 */
export class Cursor implements Record<string, any> {
  /**
   * The entity ID stored in the cursor.
   */
  id?: string;

  /**
   * Allows additional properties to be stored in the cursor.
   */
  [key: string]: any;

  constructor(cursor: string | Record<string, any>) {
    if (typeof cursor === "string") {
      try {
        const payload = JSON.parse(Buffer.from(cursor, "base64").toString());

        Object.entries(payload).forEach(([key, value]) => {
          this[key] = value;
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        //
      }
    } else {
      Object.entries(cursor).forEach(([key, value]) => {
        this[key] = value;
      });
    }
  }

  /**
   * Converts the cursor to a base64-encoded string representation.
   *
   * @returns The cursor encoded as a base64 JSON string
   */
  toString(): string {
    return Buffer.from(JSON.stringify(this)).toString("base64");
  }
}
