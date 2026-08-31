import 'reflect-metadata';
import { YoutubeProvider } from './youtube.provider';

describe('YoutubeProvider Zernio transport', () => {
  const provider = new YoutubeProvider();
  const originalApiKey = process.env.ZERNIO_API_KEY;

  beforeEach(() => {
    process.env.ZERNIO_API_KEY = 'test-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.ZERNIO_API_KEY = originalApiKey;
  });

  it('publishes a Zernio-backed YouTube video with Postiz settings', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          post: {
            _id: 'zernio-post-id',
            platforms: [
              {
                platform: 'youtube',
                platformPostUrl: 'https://www.youtube.com/watch?v=test',
              },
            ],
          },
        }),
        { status: 201 }
      )
    );

    const result = await provider.post('68f686338bbca9c10cbfe2ea', '', [
      {
        id: 'post-1',
        message: 'Video description',
        settings: {
          title: 'Video title',
          type: 'unlisted',
          selfDeclaredMadeForKids: 'no',
          thumbnail: {
            id: 'thumbnail-1',
            path: 'https://example.com/thumbnail.jpg',
          },
          tags: [
            { value: 'basketball', label: 'basketball' },
            { value: 'training', label: 'training' },
          ],
        },
        media: [
          {
            type: 'video',
            path: 'https://example.com/video.mp4',
          },
        ],
      },
    ]);

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
      content: 'Video description',
      mediaItems: [
        {
          type: 'video',
          url: 'https://example.com/video.mp4',
          thumbnail: 'https://example.com/thumbnail.jpg',
        },
      ],
      platforms: [
        {
          platform: 'youtube',
          accountId: '68f686338bbca9c10cbfe2ea',
          platformSpecificData: {
            title: 'Video title',
            visibility: 'unlisted',
            madeForKids: false,
          },
        },
      ],
      publishNow: true,
      tags: ['basketball', 'training'],
    });
    expect(result).toEqual([
      {
        id: 'post-1',
        postId: 'zernio-post-id',
        releaseURL: 'https://www.youtube.com/watch?v=test',
        status: 'success',
      },
    ]);
  });

  it('maps idempotent existing-post responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          existingPost: {
            _id: 'existing-post-id',
            platforms: [{ platform: 'youtube' }],
          },
        }),
        { status: 200 }
      )
    );

    const result = await provider.post('68f687c48bbca9c10cbfe2f2', '', [
      {
        id: 'post-2',
        message: 'Description',
        settings: {
          title: 'Title',
          type: 'private',
          selfDeclaredMadeForKids: 'yes',
          tags: [],
        },
        media: [{ type: 'video', path: 'https://example.com/video.mp4' }],
      },
    ]);

    expect(result[0].postId).toBe('existing-post-id');
  });

  it('reports safe Zernio API failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'YouTube rejected the upload' }), {
        status: 400,
        statusText: 'Bad Request',
      })
    );

    await expect(
      provider.post('69711784c955c6705a96ef93', '', [
        {
          id: 'post-3',
          message: 'Description',
          settings: { title: 'Title', type: 'public', tags: [] },
          media: [{ type: 'video', path: 'https://example.com/video.mp4' }],
        },
      ])
    ).rejects.toThrow('Zernio YouTube: YouTube rejected the upload');
  });

  it('requires a Zernio API key only for Zernio-shaped account IDs', async () => {
    delete process.env.ZERNIO_API_KEY;

    await expect(
      provider.post('69714095c955c6705a96f045', '', [
        {
          id: 'post-4',
          message: 'Description',
          settings: { title: 'Title', type: 'public', tags: [] },
          media: [{ type: 'video', path: 'https://example.com/video.mp4' }],
        },
      ])
    ).rejects.toThrow('ZERNIO_API_KEY is required for this YouTube channel');
  });
});
