import { Cursor } from "./cursor";

describe("Cursor", () => {
  it("encodes and decodes cursor payloads", () => {
    const encoded = new Cursor({ id: "1", value: "title" }).toString();

    const cursor = new Cursor(encoded);

    expect(cursor.id).toBe("1");
    expect(cursor.value).toBe("title");
  });

  it("ignores invalid cursor strings", () => {
    const cursor = new Cursor("not-base64-json");

    expect(cursor.id).toBeUndefined();
    expect(cursor.toString()).toBe("e30=");
  });
});
