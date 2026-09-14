import { REQUEST, RequestContext } from '@nest-boot/request-context';

import { createSessionContext } from './session-context.js';

describe('createSessionContext', () => {
  it.each([
    [{ 'x-workspace-id': ' 42 ', cookie: 'workspace_id=99' }, '42'],
    [{ cookie: 'workspace_id=99' }, '99'],
    [{}, ''],
  ])(
    'uses the selected workspace with an anonymous role: %o',
    async (headers, workspace) => {
      const context = new RequestContext({ type: 'http' });
      context.set(REQUEST, { headers });
      await RequestContext.run(context, () => {
        expect(createSessionContext()).toEqual({
          role: 'anonymous',
          variables: { 'app.workspace': workspace },
        });
      });
    },
  );

  it('does not read HTTP headers in background jobs', async () => {
    await RequestContext.run(new RequestContext({ type: 'job' }), () => {
      expect(createSessionContext()).toBeUndefined();
    });
  });
});
