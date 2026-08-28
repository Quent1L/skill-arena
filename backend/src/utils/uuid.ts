/**
 * Row identifier for every application table.
 *
 * UUID v7 prefixes 48 bits of millisecond timestamp, so inserts land at the end of the
 * primary key B-tree instead of fragmenting it the way gen_random_uuid() (v4) did. Rows
 * created before this change keep their v4 ids — both versions share the same `uuid`
 * column type and coexist without conversion.
 */
export const newId = (): string => Bun.randomUUIDv7();
