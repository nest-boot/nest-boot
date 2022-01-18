/* eslint-disable @typescript-eslint/no-explicit-any */

export class Cursor implements Record<string, any> {
  [key: string]: any;

  constructor(cursor: string | Record<string, any>) {
    if (!cursor) {
      return this;
    }

    if (typeof cursor === "string") {
      try {
        const payload = JSON.parse(Buffer.from(cursor, "base64").toString());

        Object.entries(payload).forEach(([key, value]) => {
          this[key] = value;
        });
      } catch (err) {
        //
      }
    } else {
      Object.entries(cursor).forEach(([key, value]) => {
        this[key] = value;
      });
    }
  }

  toString(): string {
    return Buffer.from(JSON.stringify(this)).toString("base64");
  }
}

export default Cursor;
