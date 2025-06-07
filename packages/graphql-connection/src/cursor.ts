export class Cursor implements Record<string, any> {
  id?: string;

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

  toString(): string {
    return Buffer.from(JSON.stringify(this)).toString("base64");
  }
}
