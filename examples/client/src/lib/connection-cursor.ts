import { camelCase, get } from "lodash";

/** Uses ID alone without ordering; otherwise maps GraphQL enums to camelCase fields. */
export function createConnectionCursor<Record extends { id: string }>(
  record: Record,
  orderField?: string | null,
): string {
  if (orderField == null) return encodeConnectionCursor({ id: record.id });
  const field = camelCase(orderField);
  const value: unknown = get(record, field);
  if (value === undefined) {
    throw new Error(
      `Cannot calculate a cursor: the record is missing the "${field}" sort field.`,
    );
  }
  return encodeConnectionCursor({ id: record.id, value });
}

/** Browser equivalent of @nest-boot/graphql-connection's base64 JSON cursor. */
export function encodeConnectionCursor(position: {
  id: string;
  value?: unknown;
}): string {
  const bytes = new TextEncoder().encode(JSON.stringify(position));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}
