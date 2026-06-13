import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

function htmlPolicy(html) {
  return html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
}

describe('Content Security Policy', () => {
  it('allows the Google API bootstrap required by Firebase popup auth', async () => {
    const [html, firebase] = await Promise.all([
      readFile('index.html', 'utf8'),
      readFile('firebase.json', 'utf8').then(JSON.parse),
    ]);
    const header = firebase.hosting.headers[0].headers.find(
      ({ key }) => key === 'Content-Security-Policy',
    );

    expect(htmlPolicy(html)).toContain("script-src 'self' https://apis.google.com");
    expect(header.value).toBe(htmlPolicy(html));
  });
});
