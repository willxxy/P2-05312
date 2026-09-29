export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Unable to connect. Please try again.');
  }
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || 'Unable to save. Please try again.');
  return result;
}
