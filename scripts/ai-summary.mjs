export class ExtractiveSummaryService {
  async summarize(item) {
    const content = String(item.summary || item.contentSnippet || item.content || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!content) throw new Error('No content is available for summarization.');
    return content.split(/(?<=[.!?؟])\s+/).filter(Boolean).slice(0, 3).join(' ').slice(0, 900);
  }
}

export function createSummaryService() {
  // A provider-backed implementation can be selected here without changing callers.
  return new ExtractiveSummaryService();
}
