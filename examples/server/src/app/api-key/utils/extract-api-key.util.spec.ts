import { Request } from 'express';

import { extractApiKey } from './extract-api-key.util.js';

describe('extractApiKey', () => {
  it('extracts bearer tokens from authorization headers', () => {
    expect(
      extractApiKey(
        createRequest({
          authorization: 'Bearer sk-0123456789abcdefabcdef0123456789',
        }),
      ),
    ).toBe('sk-0123456789abcdefabcdef0123456789');
    expect(
      extractApiKey(
        createRequest({
          Authorization: 'Bearer sk-abcdef01234567890123456789abcdef',
        }),
      ),
    ).toBe('sk-abcdef01234567890123456789abcdef');
  });

  it('ignores empty bearer tokens', () => {
    expect(extractApiKey(createRequest({ authorization: 'Bearer   ' }))).toBe(
      null,
    );
  });

  it('extracts x-api-key header values', () => {
    expect(
      extractApiKey(
        createRequest({
          'x-api-key': 'sk-0123456789abcdefabcdef0123456789',
        }),
      ),
    ).toBe('sk-0123456789abcdefabcdef0123456789');
  });

  it('returns null when no api key is present', () => {
    expect(extractApiKey(createRequest({}))).toBeNull();
  });

  it('returns null when request is missing', () => {
    expect(extractApiKey(null)).toBeNull();
    expect(extractApiKey(undefined)).toBeNull();
  });
});

function createRequest(headers: Record<string, unknown>) {
  return {
    headers,
  } as Request;
}
