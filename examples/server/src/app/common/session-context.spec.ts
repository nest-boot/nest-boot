import { REQUEST, RequestContext } from '@nest-boot/request-context';

import { createSessionContext } from './session-context.js';

describe('createSessionContext', () => {
  it.each([
    { 'x-workspace-id': ' 42 ', cookie: 'workspace_id=99' },
    { cookie: 'workspace_id=99' },
    { 'x-workspace-id': 'malformed', cookie: 'workspace_id=invalid' },
    {},
  ])(
    'initializes an anonymous scope without trusting selection headers: %o',
    async (headers) => {
      const context = new RequestContext({ type: 'http' });
      context.set(REQUEST, { headers });
      await RequestContext.run(context, () => {
        expect(createSessionContext()).toEqual({
          role: 'anonymous',
          variables: {
            'app.auth.user.id': '',
            'app.auth.workspace_member.id': '',
            'app.auth.workspace.id': '',
            'app.selected.workspace.id': '',
          },
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
