import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import rule from "./card-structure.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});
const imports = `
  import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from "@/components/ui/card";
  import { Input } from "@/components/thread-ui/input";
  import { Button } from "@/components/thread-ui/button";
`;
const code = (jsx) => `${imports} const view = (${jsx});`;
const invalid = (jsx, messageId) => ({
  code: code(jsx),
  errors: [{ messageId }],
});

tester.run("card-structure", rule, {
  valid: [
    code(`<Card><CardHeader><CardTitle>Profile</CardTitle><CardDescription>Details</CardDescription></CardHeader>
      <CardContent><form id="profile"><Input /></form></CardContent>
      <CardFooter><Button type="submit" form="profile">Save</Button></CardFooter></Card>`),
    // Inline list actions and pagination belong with the list.
    code(
      `<Card><CardContent>{rows.map(row => <Button onClick={row.revoke}>Revoke</Button>)}<Button>Load more</Button></CardContent></Card>`,
    ),
    code(
      `<Card><CardHeader><CardTitle>Sessions</CardTitle><CardAction><Button>Refresh</Button></CardAction></CardHeader></Card>`,
    ),
    // Reusable components may provide multiple Card sections as a fragment.
    code(
      `<><CardContent><Input /></CardContent><CardFooter><Button type="submit" form="member">Save</Button></CardFooter></>`,
    ),
    // Render-prop forms and conditional footers keep their Card ancestry.
    code(
      `<Card><CardContent><form.Field>{() => <Input />}</form.Field></CardContent>{ready && <CardFooter><form.Subscribe>{() => <Button type="submit">Save</Button>}</form.Subscribe></CardFooter>}</Card>`,
    ),
    code(
      `<Card><CardContent><Card><CardHeader><CardTitle>Nested</CardTitle></CardHeader><CardFooter><Button type="submit">Save</Button></CardFooter></Card></CardContent></Card>`,
    ),
    `${imports} import { DialogContent } from "@/components/ui/dialog";
      const view = <Card><CardContent><DialogContent><Input /><Button type="submit">Create</Button></DialogContent></CardContent></Card>;`,
    `const CardContent = CustomContent; const CardFooter = CustomFooter;
      const view = <CardContent><CardFooter /></CardContent>;`,
    `${imports} function View({CardContent}) { return <CardContent><Button type="submit">Save</Button></CardContent>; }`,
    code(`<form><Input /><Button type="submit">Submit</Button></form>`),
  ],
  invalid: [
    invalid(`<Card><CardTitle>Profile</CardTitle></Card>`, "header"),
    invalid(
      `<Card><CardContent><CardDescription>Details</CardDescription></CardContent></Card>`,
      "header",
    ),
    invalid(`<Card><CardFooter><CardAction /></CardFooter></Card>`, "header"),
    invalid(
      `<Card><CardContent><CardFooter /></CardContent></Card>`,
      "section",
    ),
    invalid(`<Card><CardFooter><CardContent /></CardFooter></Card>`, "section"),
    invalid(
      `<Card><CardContent><div><CardHeader /></div></CardContent></Card>`,
      "section",
    ),
    invalid(`<Card><Input /></Card>`, "content"),
    invalid(`<Card><CardHeader><Input /></CardHeader></Card>`, "content"),
    invalid(`<Card><CardFooter><Input /></CardFooter></Card>`, "content"),
    invalid(
      `<Card><CardContent><Button type="submit">Save</Button></CardContent></Card>`,
      "submit",
    ),
    invalid(
      `<CardContent><form.Subscribe>{() => <Button type={"submit"}>Save</Button>}</form.Subscribe></CardContent>`,
      "submit",
    ),
    invalid(
      `<Card><CardHeader><Button>Delete</Button></CardHeader></Card>`,
      "action",
    ),
    invalid(`<Card><Button>Delete</Button></Card>`, "action"),
    {
      code: `import { CardContent as Body, CardFooter as Footer } from "@/components/ui/card";
        const view = <Body><Footer /></Body>;`,
      errors: [{ messageId: "section" }],
    },
    {
      code: `import * as C from "@/components/ui/card";
        import * as B from "@/components/thread-ui/button";
        const view = <C.Card><C.CardContent><B.Button type="submit">Save</B.Button></C.CardContent></C.Card>;`,
      errors: [{ messageId: "submit" }],
    },
  ],
});
