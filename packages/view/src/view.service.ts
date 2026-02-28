import { Injectable } from "@nestjs/common";
import type Handlebars from "handlebars";
import { type RuntimeOptions, type TemplateDelegate } from "handlebars";
import { create } from "handlebars";

/**
 * Service for rendering Handlebars templates.
 *
 * @remarks
 * Templates are registered by name and can be rendered with optional
 * Handlebars runtime options (helpers, partials, data).
 */
@Injectable()
export class ViewService {
  /** Handlebars instance. @internal */
  private readonly handlebars: typeof Handlebars = create();

  /** Map of template names to compiled template delegates. @internal */
  private readonly templates = new Map<string, TemplateDelegate>();

  /**
   * Registers a Handlebars template by name.
   * @param name - Unique identifier for the template (dot-separated path)
   * @param template - The raw Handlebars template string
   */
  register(name: string, template: string): void {
    this.templates.set(name, this.handlebars.compile(template));
  }

  /**
   * Removes a registered template by name.
   * @param name - The template identifier to remove
   */
  unregister(name: string): void {
    this.templates.delete(name);
  }

  /**
   * Renders a registered template.
   * @param name - The template identifier
   * @param options - Optional Handlebars runtime options
   * @returns The rendered string, or undefined if the template is not registered
   */
  render(name: string, options?: RuntimeOptions): string | undefined {
    return this.templates.get(name)?.(options);
  }
}
