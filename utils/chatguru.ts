/**
 * Utility functions for ChatGuru API integration
 */

/**
 * Convert an object to application/x-www-form-urlencoded format
 */
export function formEncodedRequest(params: Record<string, any>): string {
  return Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      // Handle special case for empty text field
      if (key === 'text' && (value === '' || value === null)) {
        return `${encodeURIComponent(key)}=${encodeURIComponent(' ')}`;
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    })
    .join('&');
}

/**
 * Make a request to ChatGuru API
 */
export async function chatGuruRequest(
  server: string,
  endpoint: string,
  params: Record<string, any>
): Promise<any> {
  const baseUrl = `https://${server}.chatguru.app/api/v1`;
  const url = `${baseUrl}/${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formEncodedRequest(params),
  });

  if (!response.ok) {
    throw new Error(`ChatGuru API error: ${response.status}`);
  }

  return response.json();
}