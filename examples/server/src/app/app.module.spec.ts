import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Node,
  type ObjectLiteralExpression,
  Project,
  SyntaxKind,
} from 'ts-morph';

const currentDir = dirname(fileURLToPath(import.meta.url));

describe('AppModule', () => {
  it('registers the combined authentication and permission guard', () => {
    const sourceFile = new Project().createSourceFile(
      'app.module.ts',
      readFileSync(join(currentDir, 'app.module.ts'), 'utf8'),
    );
    const appModule = sourceFile.getClassOrThrow('AppModule');
    const moduleDecorator = appModule.getDecoratorOrThrow('Module');
    const metadata = moduleDecorator
      .getArguments()[0]
      .asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    expect(
      getPropertyAssignment(metadata, 'imports')
        .getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression)
        .getElements()
        .map((element) => element.getText()),
    ).toEqual(['CommonModule', 'AuthModule', 'JobsModule']);
    const providers = getPropertyAssignment(metadata, 'providers')
      .getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression)
      .getElements();

    const guardProviders = providers
      .filter(Node.isObjectLiteralExpression)
      .filter(
        (provider) => getPropertyText(provider, 'provide') === 'APP_GUARD',
      )
      .map((provider) => getPropertyText(provider, 'useExisting'));

    expect(guardProviders).toEqual(['AuthGuard']);
  });
});

/**
 * Returns property assignment with the requested name.
 * @param objectLiteral - Object literal expression to inspect.
 * @param name - Name used to identify the resource.
 * @returns Property assignment with the requested name.
 */
function getPropertyAssignment(
  objectLiteral: ObjectLiteralExpression,
  name: string,
) {
  const property = objectLiteral.getPropertyOrThrow(name);

  if (!Node.isPropertyAssignment(property)) {
    throw new Error(`${name} is not a property assignment`);
  }

  return property;
}

/**
 * Returns source text of the property's initializer, when present.
 * @param objectLiteral - Object literal expression to inspect.
 * @param name - Name used to identify the resource.
 * @returns Source text of the property's initializer, when present.
 */
function getPropertyText(objectLiteral: ObjectLiteralExpression, name: string) {
  return getPropertyAssignment(objectLiteral, name).getInitializer()?.getText();
}
