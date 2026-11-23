// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useForm } from "@tanstack/react-form";
import { defaultFormOptions, handleFieldBlur, submitForm } from "@/lib/form";
import { getFormErrorMessage } from "@/lib/form-errors";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/thread-ui/input";

afterEach(cleanup);

function Example({
  id,
  save,
}: {
  id: string;
  save: (value: { email: string }) => Promise<void>;
}) {
  const form = useForm({
    ...defaultFormOptions,
    defaultValues: { email: "" },
    validators: {
      onDynamic: z.object({ email: z.string().email("Invalid email") }),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await save(value);
      } catch {
        formApi.setErrorMap({
          onSubmit: { form: "Temporary failure", fields: {} },
        });
      }
    },
  });
  return (
    <section data-testid={id}>
      <form
        id={id}
        noValidate
        onSubmit={(event) => {
          void submitForm(event, form);
        }}
      >
        <form.Field name="email">
          {(field) => (
            <Input
              name={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={() => handleFieldBlur(field)}
              error={getFormErrorMessage(field.state.meta.errors)}
              label="Email"
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => getFormErrorMessage(state.errors)}>
          {(error) => (error ? <p role="alert">{error}</p> : null)}
        </form.Subscribe>
      </form>
      <SubmitButton formApi={form} form={id}>
        Save
      </SubmitButton>
    </section>
  );
}

describe("shared useForm behavior", () => {
  it("validates on submit, focuses within that form, and revalidates changes", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <>
        <Example id="first" save={save} />
        <Example id="second" save={save} />
      </>,
    );
    const second = within(screen.getByTestId("second"));
    const email = second.getByLabelText("Email");
    fireEvent.change(email, { target: { value: "invalid" } });
    expect(screen.queryByText("Invalid email")).toBeNull();
    fireEvent.click(second.getByRole("button", { name: /Save$/ }));
    await second.findByText("Invalid email");
    await waitFor(() => expect(document.activeElement).toBe(email));
    expect(save).not.toHaveBeenCalled();
    expect(email.getAttribute("name")).toBe("email");
    fireEvent.change(email, { target: { value: "valid@example.com" } });
    await waitFor(() => expect(second.queryByText("Invalid email")).toBeNull());
    fireEvent.click(second.getByRole("button", { name: /Save$/ }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledExactlyOnceWith({
        email: "valid@example.com",
      }),
    );
  });

  it("allows retrying unchanged values after a request error", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("failure"))
      .mockResolvedValue(undefined);
    render(<Example id="retry" save={save} />);
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", { name: /Save$/ }),
    );
    await screen.findByText("Invalid email");
    fireEvent.change(screen.getByLabelText<HTMLInputElement>("Email"), {
      target: { value: "draft@example.com" },
    });
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", { name: /Save$/ }),
    );
    await screen.findByText("Temporary failure");
    expect(
      screen
        .getByRole("button", { name: /Save$/ })
        .getAttribute("aria-disabled"),
    ).not.toBe("true");
    fireEvent.blur(screen.getByLabelText<HTMLInputElement>("Email"));
    expect(screen.getByText("Temporary failure")).toBeTruthy();
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", { name: /Save$/ }),
    );
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe(
      "draft@example.com",
    );
    await waitFor(() =>
      expect(screen.queryByText("Temporary failure")).toBeNull(),
    );
  });

  it("blocks duplicate Enter submissions while the request is pending", async () => {
    let release!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { container } = render(<Example id="pending" save={save} />);
    fireEvent.change(screen.getByLabelText<HTMLInputElement>("Email"), {
      target: { value: "pending@example.com" },
    });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    fireEvent.submit(container.querySelector("form")!);
    expect(save).toHaveBeenCalledOnce();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /Save$/ }).disabled,
    ).toBe(true);
    release();
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: /Save$/ })
          .disabled,
      ).toBe(false),
    );
  });
});
