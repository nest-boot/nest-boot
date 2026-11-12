// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import en from "../../public/locales/en/api-key.json";
import { ApiKeySecretField } from "./api-key-secret-field";
import { toast } from "./thread-ui/toast";
import type { ReactNode } from "react";

const i18n = createInstance();
const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
const writeText = vi.fn<(_text: string) => Promise<void>>();
beforeAll(async () => {
  await i18n.init({ lng: "en", resources: { en: { "api-key": en } } });
});
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalClipboard)
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});
function wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe("API-key secret display", () => {
  it("renders only disabled metadata when a creation secret is unavailable", () => {
    render(<ApiKeySecretField id="key" start="user_abc" />, { wrapper });
    const input = screen.getByLabelText<HTMLInputElement>("Key");
    expect(input.value).toBe("user_abc...");
    expect(input.disabled).toBe(true);
    expect(screen.queryByRole("button")).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the creation secret and removes it when its context clears", async () => {
    const secret = "user_creation_secret";
    const { rerender } = render(
      <ApiKeySecretField id="key" secret={secret} start="user_abc" />,
      { wrapper },
    );
    const input = screen.getByLabelText<HTMLInputElement>("Key");
    expect(input.value).toBe(secret);
    expect(input.readOnly).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: en.created.copy }));
    await screen.findByRole("button", { name: en.created.copied });
    expect(writeText).toHaveBeenCalledExactlyOnceWith(secret);
    rerender(<ApiKeySecretField id="key" start="user_abc" />);
    expect(input.value).toBe("user_abc...");
    expect(input.disabled).toBe(true);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reports clipboard failure without displaying copied feedback", async () => {
    writeText.mockRejectedValueOnce(new Error("Clipboard unavailable"));
    const add = vi.spyOn(toast, "add").mockReturnValue("copy-error");
    render(<ApiKeySecretField id="key" secret="user_creation_secret" />, {
      wrapper,
    });
    fireEvent.click(screen.getByRole("button", { name: en.created.copy }));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        type: "error",
        title: en.created.copy_failed,
      }),
    );
    expect(
      screen.queryByRole("button", { name: en.created.copied }),
    ).toBeNull();
  });
});
