import { RAGContextBuilder } from './RAGContextBuilder.js';

export class FeedbackProcessor {
  static async save(userId, { messageId, sessionId, rating, note, componentType }) {
    const { FeedbackStorage } = await import('../api/database/index.js');
    await FeedbackStorage.append({ userId, messageId, sessionId, rating, note: note||null, componentType: componentType||null, savedAt: new Date().toISOString() });
    if (note) await RAGContextBuilder.learn({ type: 'user', key: userId, finding: note }).catch(() => {});
  }

  static async getPatterns(userId) {
    const { FeedbackStorage } = await import('../api/database/index.js');
    const all = await FeedbackStorage.findByUserId(userId);
    const liked    = [...new Set(all.filter(f => f.rating > 0).map(f => f.componentType))];
    const disliked = [...new Set(all.filter(f => f.rating < 0).map(f => f.componentType))];
    return { liked, disliked };
  }
}
