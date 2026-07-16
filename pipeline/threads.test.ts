import { describe, expect, it, vi } from 'vitest';
import { publishThreadsText, THREADS_TEXT_LIMIT } from './threads';

describe('publishThreadsText', () => {
  it("uses Meta's create-container then publish flow without exposing the token in URLs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'post-1' }), { status: 200 }));

    await expect(
      publishThreadsText(
        {
          accessToken: 'secret-token',
          text: 'AI news, without the noise.',
          apiBase: 'https://threads.test',
        },
        fetchMock,
      ),
    ).resolves.toEqual({ id: 'post-1', creationId: 'container-1' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [createUrl, createInit] = fetchMock.mock.calls[0]!;
    expect(String(createUrl)).toBe(
      'https://threads.test/me/threads?media_type=TEXT&text=AI+news%2C+without+the+noise.',
    );
    expect(createInit.headers.Authorization).toBe('Bearer secret-token');
    expect(String(createUrl)).not.toContain('secret-token');
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://threads.test/me/threads_publish?creation_id=container-1',
    );
  });

  it('validates content before making a provider request', async () => {
    const fetchMock = vi.fn();
    await expect(
      publishThreadsText(
        { accessToken: 'token', text: 'x'.repeat(THREADS_TEXT_LIMIT + 1) },
        fetchMock,
      ),
    ).rejects.toThrow('exceeds');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a useful provider error without including credentials', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Invalid token' } }), { status: 401 }),
      );
    await expect(
      publishThreadsText({ accessToken: 'secret-token', text: 'hello' }, fetchMock),
    ).rejects.toThrow('Invalid token');
  });
});
