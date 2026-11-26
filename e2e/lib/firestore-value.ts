export type FsValue =
  | { nullValue: null } | { booleanValue: boolean } | { integerValue: string } | { doubleValue: number }
  | { stringValue: string } | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } } | { mapValue: { fields?: Record<string, FsValue> } };

function encode(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
  throw new Error(`cannot encode ${typeof v}`);
}

function decode(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields);
  return undefined;
}

export const encodeFields = (obj: Record<string, unknown>): Record<string, FsValue> =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, encode(v)]));

export const decodeFields = (fields: Record<string, FsValue> | undefined): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, decode(v)]));
