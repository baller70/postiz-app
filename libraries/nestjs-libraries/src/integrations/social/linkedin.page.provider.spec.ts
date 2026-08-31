import { LinkedinPageProvider } from './linkedin.page.provider';
import { LinkedinProvider } from './linkedin.provider';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

describe('LinkedinPageProvider Zernio transport', () => {
  const provider = new LinkedinPageProvider();
  const originalApiKey = process.env.ZERNIO_API_KEY;
  const originalJwtSecret = process.env.JWT_SECRET;
  const zernioIntegration = {
    customInstanceDetails: JSON.stringify({ transport: 'zernio' }),
  } as any;

  beforeEach(() => {
    process.env.ZERNIO_API_KEY = 'test-key';
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.ZERNIO_API_KEY = originalApiKey;
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('publishes Zernio-backed LinkedIn pages through the Zernio API', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          post: {
            _id: 'zernio-post-id',
            platforms: [
              {
                platform: 'linkedin',
                platformPostUrl: 'https://www.linkedin.com/feed/update/test',
              },
            ],
          },
        }),
        { status: 200 }
      )
    );
    const result = await provider.post(
      '69e648367dea335c2b158990',
      '',
      [
        {
          id: 'post-1',
          message: 'Post from Postiz',
          settings: {},
          media: [
            {
              type: 'image',
              path: 'https://example.com/image.png',
            },
          ],
        },
      ],
      zernioIntegration
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://zernio.com/api/v1/posts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'x-request-id': 'post-1',
        }),
      })
    );

    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(request.body as string)).toEqual({
      content: 'Post from Postiz',
      platforms: [
        { platform: 'linkedin', accountId: '69e648367dea335c2b158990' },
      ],
      publishNow: true,
      mediaItems: [{ type: 'image', url: 'https://example.com/image.png' }],
    });
    expect(result).toEqual([
      {
        id: 'post-1',
        postId: 'zernio-post-id',
        releaseURL: 'https://www.linkedin.com/feed/update/test',
        status: 'success',
      },
    ]);
  });

  it('reports Zernio publishing failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'LinkedIn rejected the post' }), {
        status: 400,
        statusText: 'Bad Request',
      })
    );

    await expect(
      provider.post(
        '69e648367dea335c2b158990',
        '',
        [{ id: 'post-2', message: 'Post', settings: {} }],
        zernioIntegration
      )
    ).rejects.toThrow('Zernio LinkedIn: LinkedIn rejected the post');
  });

  it('recognizes an encrypted Zernio transport marker', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ post: { _id: 'encrypted-marker-post' } }), {
        status: 200,
      })
    );

    await provider.post(
      '69e648577dea335c2b158a28',
      '',
      [{ id: 'post-3', message: 'Encrypted marker', settings: {} }],
      {
        customInstanceDetails: AuthService.fixedEncryption(
          JSON.stringify({ transport: 'zernio' })
        ),
      } as any
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://zernio.com/api/v1/posts',
      expect.any(Object)
    );
  });

  it('keeps unmarked LinkedIn pages on the native Postiz transport', async () => {
    const nativeResult = [
      {
        id: 'post-4',
        postId: 'native-linkedin-post',
        releaseURL: '',
        status: 'success' as const,
      },
    ];
    const nativePost = jest
      .spyOn(LinkedinProvider.prototype, 'post')
      .mockResolvedValue(nativeResult);

    const result = await provider.post(
      '69e647b87dea335c2b15873d',
      'native-token',
      [{ id: 'post-4', message: 'Native post', settings: {} }],
      { customInstanceDetails: null } as any
    );

    expect(nativePost).toHaveBeenCalledWith(
      '69e647b87dea335c2b15873d',
      'native-token',
      expect.any(Array),
      expect.objectContaining({ customInstanceDetails: null }),
      'company'
    );
    expect(result).toEqual(nativeResult);
  });

  it('rejects malformed Zernio account IDs', async () => {
    await expect(
      provider.post(
        'not-a-zernio-id',
        '',
        [{ id: 'post-5', message: 'Post', settings: {} }],
        zernioIntegration
      )
    ).rejects.toThrow('Invalid Zernio account ID for this LinkedIn Page');
  });

  it('requires the Zernio API key for marked records', async () => {
    delete process.env.ZERNIO_API_KEY;

    await expect(
      provider.post(
        '69e647b87dea335c2b15873d',
        '',
        [{ id: 'post-6', message: 'Post', settings: {} }],
        zernioIntegration
      )
    ).rejects.toThrow(
      'ZERNIO_API_KEY is required for this LinkedIn Page channel'
    );
  });
});
