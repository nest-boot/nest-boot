import { forEach, isPlainObject, transform } from "lodash";

type DataFilterRecord = Record<string, any>;

export const flattenObject = (obj: DataFilterRecord): DataFilterRecord => {
  return transform<DataFilterRecord, DataFilterRecord>(
    obj,
    (result, value, key) => {
      if (isPlainObject(value)) {
        const nested = flattenObject(value);
        forEach(nested, (nestedValue, nestedKey) => {
          result[`${String(key)}.${nestedKey}`] = nestedValue;
        });
      } else {
        result[key] = value;
      }
    },
    {},
  );
};
