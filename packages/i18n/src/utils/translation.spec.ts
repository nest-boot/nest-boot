import { RequestContext } from "@nest-boot/request-context";
import i18next from "i18next";

import { I18N } from "../i18n.constants.js";
import { t, translation } from "./translation.js";

describe("translation", () => {
  beforeEach(async () => {
    await i18next.init({
      lng: "en",
      resources: {
        en: { translation: { greeting: "Hello", welcome: "Hello {{name}}" } },
      },
    });
  });

  it("uses the request-scoped i18n instance", async () => {
    const instance = i18next.createInstance();
    await instance.init({
      lng: "en",
      resources: { de: { translation: { greeting: "Hallo" } } },
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(I18N, instance);
      expect(translation("greeting", { lng: "de" })).toBe("Hallo");
    });
  });

  it("uses the global instance outside a request context", () => {
    expect(RequestContext.isActive()).toBe(false);
    expect(translation(["missing", "greeting"])).toBe("Hello");
    expect(t("welcome", { name: "Ada" })).toBe("Hello Ada");
  });

  it("uses the global instance when the active context has no i18n instance", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      expect(translation("greeting")).toBe("Hello");
    });
  });

  it("exports t as an alias", () => {
    expect(t).toBe(translation);
  });
});
