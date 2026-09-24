const cardSource = "@/components/ui/card";
const sections = new Set(["CardHeader", "CardContent", "CardFooter"]);
const headerParts = new Set(["CardTitle", "CardDescription", "CardAction"]);
const fields = new Set([
  "Input",
  "Textarea",
  "Select",
  "Checkbox",
  "CheckboxGroup",
  "RadioGroup",
  "Switch",
  "NumberInput",
  "RoleCheckboxGroup",
  "PermissionCheckboxGroup",
]);
const portals = new Set([
  "DialogContent",
  "AlertDialogContent",
  "SheetContent",
  "DrawerContent",
  "PopoverContent",
]);

// Resolve the actual import, including aliases and namespaces. A local component
// named Card or a shadowed import must not acquire shadcn's composition rules.
function getImport(context, element) {
  const tag = element.name;
  const identifier = tag.type === "JSXIdentifier" ? tag : tag.object;
  if (identifier?.type !== "JSXIdentifier") return;

  for (
    let scope = context.sourceCode.getScope(element);
    scope;
    scope = scope.upper
  ) {
    const variable = scope.set.get(identifier.name);
    if (!variable) continue;
    const definition = variable.defs.find(
      (def) => def.type === "ImportBinding",
    );
    if (!definition) return;
    const specifier = definition.node;
    const source = definition.parent.source.value;
    if (specifier.type === "ImportSpecifier" && tag.type === "JSXIdentifier") {
      return {
        source,
        name: specifier.imported.name ?? specifier.imported.value,
      };
    }
    if (
      specifier.type === "ImportNamespaceSpecifier" &&
      tag.type === "JSXMemberExpression"
    ) {
      return { source, name: tag.property.name };
    }
    return;
  }
}

function getCardParent(context, element) {
  for (let node = element.parent.parent; node; node = node.parent) {
    if (node.type !== "JSXElement") continue;
    const imported = getImport(context, node.openingElement);
    if (!imported) continue;
    if (
      imported.source.startsWith("@/components/ui/") &&
      portals.has(imported.name)
    )
      return;
    if (imported.source === cardSource) return imported.name;
  }
}

function isSubmit(element) {
  const type = element.attributes.find(
    (attribute) =>
      attribute.type === "JSXAttribute" && attribute.name.name === "type",
  )?.value;
  return (
    type?.value === "submit" ||
    (type?.type === "JSXExpressionContainer" &&
      type.expression.value === "submit")
  );
}

export default {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      section:
        "{{name}} must be a sibling of the other Card sections, not nested in {{parent}}.",
      header: "Place {{name}} inside CardHeader.",
      content: "Place {{name}} inside CardContent.",
      submit:
        "Place Card submit buttons in CardFooter; associate an external form with the form prop.",
      action:
        "Place standalone Card actions in CardFooter, or header controls in CardAction.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(element) {
        const imported = getImport(context, element);
        if (!imported) return;
        const parent = getCardParent(context, element);
        // Standalone Card pieces may be composed by another component. Only
        // enforce relationships that are visible in this JSX tree.
        if (!parent) return;
        const { name, source } = imported;
        let messageId;
        if (source === cardSource) {
          if (sections.has(name) && parent !== "Card") messageId = "section";
          if (headerParts.has(name) && parent !== "CardHeader")
            messageId = "header";
        } else if (source.startsWith("@/components/")) {
          if (fields.has(name) && parent !== "CardContent")
            messageId = "content";
          if (name === "Button") {
            if (isSubmit(element) && parent !== "CardFooter")
              messageId = "submit";
            else if (parent === "Card" || parent === "CardHeader")
              messageId = "action";
          }
        }
        if (messageId)
          context.report({ node: element, messageId, data: { name, parent } });
      },
    };
  },
};
