/**
 * Horizontal Validator - validates data consistency across chunks
 */

export class HorizontalValidator {
  /**
   * Validate chunk boundary
   */
  validateChunkBoundary(previousChunk, currentChunk) {
    if (!previousChunk) return { valid: true };

    const gap = currentChunk.startBlock - previousChunk.endBlock;
    
    if (gap > 1) {
      return {
        valid: false,
        error: `Gap detected: ${gap - 1} blocks missing between chunks`,
        missingBlocks: { start: previousChunk.endBlock + 1, end: currentChunk.startBlock - 1 }
      };
    }

    return { valid: true };
  }

  /**
   * Detect missing data
   */
  detectMissingData(chunks) {
    const missing = [];
    
    for (let i = 1; i < chunks.length; i++) {
      const result = this.validateChunkBoundary(chunks[i - 1], chunks[i]);
      if (!result.valid) {
        missing.push(result.missingBlocks);
      }
    }

    return missing;
  }

  /**
   * Verify transaction continuity
   */
  verifyTransactionContinuity(chunkData) {
    // Check for duplicate transactions or missing sequences
    const txHashes = new Set();
    let duplicates = 0;

    for (const log of chunkData.logs || []) {
      if (txHashes.has(log.transactionHash)) {
        duplicates++;
      }
      txHashes.add(log.transactionHash);
    }

    return { valid: duplicates === 0, duplicates };
  }
}
