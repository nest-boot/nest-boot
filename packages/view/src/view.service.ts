import { Injectable } from "@nestjs/common";
import type Handlebars from "handlebars";
import { type RuntimeOptions, type TemplateDelegate } from "handlebars";
import { create } from "handlebars";

@Injectable()
export class ViewService {
  private readonly handlebars: typeof Handlebars = create();

  private readonly templates = new Map<string, TemplateDelegate>();

  register(name: string, template: string): void {
    this.templates.set(name, this.handlebars.compile(template));
  }

  unregister(name: string): void {
    this.templates.delete(name);
  }

  render(name: string, options?: RuntimeOptions): string | undefined {
    return this.templates.get(name)?.(options);
  }
}
