import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Node,
  type ObjectLiteralExpression,
  Project,
  PropertyAssignment,
  SyntaxKind,
} from 'ts-morph';

const currentDir = dirname(fileURLToPath(import.meta.url));

describe('AppModule', () => {
  it('registers authentication before permission guards', () => {
    const sourceFile = new Project().createSourceFile(
      'app.module.ts',
      readFileSync(join(currentDir, 'app.module.ts'), 'utf8'),
    );
    const appModule = sourceFile.getClassOrThrow('AppModule');
    const moduleDecorator = appModule.getDecoratorOrThrow('Module');
    const metadata = moduleDecorator
      .getArguments()[0]
      .asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const providers = getPropertyAssignment(metadata, 'providers')
      .getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression)
      .getElements();

    const guardProviders = providers
      .filter(Node.isObjectLiteralExpression)
      .filter(
        (provider) => getPropertyText(provider, 'provide') === 'APP_GUARD',
      )
      .map((provider) => getPropertyText(provider, 'useExisting'));

    expect(guardProviders).toEqual(['AuthGuard', 'PermissionGuard']);
  });
});

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

function getPropertyText(objectLiteral: ObjectLiteralExpression, name: string) {
  return getPropertyAssignment(objectLiteral, name).getInitializer()?.getText();
}
