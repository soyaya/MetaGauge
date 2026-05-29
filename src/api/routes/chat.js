/**
 * Chat routes for AI-powered contract conversations
 * Handles chat sessions and real-time messaging
 */

import express from 'express';
import { ChatSessionStorage, ChatMessageStorage, ContractStorage } from '../database/index.js';
import ChatAIService from '../../services/ChatAIService.js';
import { authenticateToken } from '../middleware/auth.js';
import businessAI from '../../services/BusinessAIEngine.js';
import subscriptionService from '../../services/SubscriptionService.js';
import { LIMITS } from '../../config/pricing.js';

const router = express.Router();

/**
 * @swagger
 * /api/chat/sessions:
 *   get:
 *     summary: Get user's chat sessions
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractAddress
 *         schema:
 *           type: string
 *         description: Filter by contract address
 *       - in: query
 *         name: contractChain
 *         schema:
 *           type: string
 *         description: Filter by contract chain
 *     responses:
 *       200:
 *         description: Chat sessions retrieved successfully
 */
router.get('/sessions', async (req, res) => {
  try {
    const { contractAddress, contractChain } = req.query;
    const userId = req.user.id;

    const filters = {};
    if (contractAddress) filters.contractAddress = contractAddress;
    if (contractChain) filters.contractChain = contractChain;

    const sessions = await ChatSessionStorage.findByUserId(userId, filters);

    res.json({
      sessions: sessions,
      total: sessions.length
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve chat sessions',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/chat/sessions:
 *   post:
 *     summary: Create or get chat session for a contract
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractAddress
 *               - contractChain
 *             properties:
 *               contractAddress:
 *                 type: string
 *               contractChain:
 *                 type: string
 *               contractName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chat session created or retrieved successfully
 */
router.post('/sessions', async (req, res) => {
  try {
    const { contractAddress, contractChain, contractName, contractId } = req.body;
    const userId = req.user.id;

    let address = contractAddress;
    let chain = contractChain;
    let name = contractName;

    // If contractId provided, look up the contract
    if (contractId && !address) {
      const contract = await ContractStorage.findById(contractId);
      if (contract) {
        address = contract.targetContract.address;
        chain = contract.targetContract.chain;
        name = contract.targetContract.name || contract.name;
      }
    }

    if (!address || !chain) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Either contractId OR (contractAddress + contractChain) are required'
      });
    }

    // Check if session already exists for this contract
    let session = await ChatSessionStorage.findByContract(userId, address, chain);

    if (!session) {
      // Create new session
      console.log('Creating new session for:', { userId, address, chain });
      session = await ChatSessionStorage.create({
        userId,
        contractAddress: address.toLowerCase(),
        contractChain: chain,
        contractName: name || 'Unknown Contract',
        title: `Chat: ${name || address.slice(0, 8)}...`
      });
      console.log('Session created:', session);

      // Add welcome message (simplified)
      try {
        console.log('Creating welcome message for session:', session.id);
        await ChatMessageStorage.create({
          sessionId: session.id,
          role: 'assistant',
          content: `Hello! I'm your AI assistant for analyzing the contract ${address} on ${chain}. What would you like to know?`,
          components: []
        });
        console.log('Welcome message created');
      } catch (error) {
        console.error('Error creating welcome message:', error);
        // Continue without welcome message
      }
    }

    // Get contract context and suggested questions
    let contractContext = {};
    let suggestedQuestions = [];
    
    try {
      contractContext = await ChatAIService.getContractContext(userId, contractAddress, contractChain);
      suggestedQuestions = await ChatAIService.generateSuggestedQuestions(contractContext);
    } catch (error) {
      console.error('Error getting contract context:', error);
      // Continue with empty context
    }

    res.json({
      sessionId: session.id,
      id: session.id,
      session: session,
      contractContext,
      suggestedQuestions,
      aiEnabled: ChatAIService.isEnabled()
    });

  } catch (error) {
    console.error('Chat session creation error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to create chat session',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/chat/sessions/{sessionId}:
 *   get:
 *     summary: Get chat session details
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat session retrieved successfully
 *       404:
 *         description: Session not found
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await ChatSessionStorage.findById(sessionId);

    if (!session || session.userId !== userId) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Chat session not found or access denied'
      });
    }

    // Get contract context
    const contractContext = await ChatAIService.getContractContext(
      userId, 
      session.contractAddress, 
      session.contractChain
    );

    res.json({
      session: session,
      contractContext,
      aiEnabled: ChatAIService.isEnabled()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve chat session',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/messages:
 *   get:
 *     summary: Get chat messages for a session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Chat messages retrieved successfully
 *       404:
 *         description: Session not found
 */
router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    const session = await ChatSessionStorage.findById(sessionId);

    if (!session || session.userId !== userId) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Chat session not found or access denied'
      });
    }

    const messages = await ChatMessageStorage.findBySessionId(
      sessionId, 
      parseInt(limit), 
      parseInt(offset)
    );

    res.json({
      messages: messages,
      total: messages.length,
      hasMore: messages.length === parseInt(limit)
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve chat messages',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/messages:
 *   post:
 *     summary: Send a message in a chat session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The user's message
 *     responses:
 *       200:
 *         description: Message sent and AI response generated
 *       404:
 *         description: Session not found
 */
router.post('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content, message } = req.body;
    const userId = req.user.id;

    // Support both 'content' and 'message' parameter names
    const messageContent = content || message;

    if (!messageContent || typeof messageContent !== 'string' || messageContent.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    if (messageContent.length > LIMITS.maxMessageLength) {
      return res.status(400).json({ error: `Message too long. Max ${LIMITS.maxMessageLength} characters.` });
    }

    const session = await ChatSessionStorage.findById(sessionId);

    if (!session || session.userId !== userId) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Chat session not found or access denied'
      });
    }

    // Hard charge — block if quota exceeded and no balance
    const charge = await subscriptionService.charge(userId, 'ai_query');
    if (!charge.allowed) {
      return res.status(402).json({
        error: charge.reason === 'quota_exceeded' ? 'Free quota exhausted' : 'Insufficient balance',
        message: charge.reason === 'quota_exceeded'
          ? 'You\'ve used your free AI queries for this month. Top up at /subscription to continue.'
          : `This query costs $0.05. Your balance is $${charge.balance}. Top up at /subscription.`,
        balance: charge.balance,
        required: charge.required,
        reason: charge.reason,
      });
    }

    // Save user message
    const userMessage = await ChatMessageStorage.create({
      sessionId,
      role: 'user',
      content: messageContent.trim(),
      components: []
    });

    // Get chat context
    const contractContext = await ChatAIService.getContractContext(
      userId, 
      session.contractAddress, 
      session.contractChain
    );

    // Get recent chat history for context
    const chatHistory = await ChatMessageStorage.getRecentContext(sessionId, 10);

    // Generate AI response via AgentService (function calling)
    const AgentService = (await import('../../services/AgentService.js')).default;
    const aiResponse = await AgentService.run(userId, messageContent.trim(), {
      contractAddress: session.contractAddress,
      chain: session.contractChain,
      sessionId,
      sessionHistory: chatHistory.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content })),
      source: 'chat',
    });

    // Save AI response (aiResponse is now { content, components[] })
    const assistantMessage = await ChatMessageStorage.create({
      sessionId,
      role: 'assistant',
      content: aiResponse.content || "I don't have enough data to answer that. Please run an analysis first.",
      components: aiResponse.components || [],
      metadata: { ragGrounded: true, toolsUsed: aiResponse.toolsUsed || [], iterations: aiResponse.iterations || 0 },
    });

    res.json({
      userMessage: userMessage,
      assistantMessage: assistantMessage,
      sessionId
    });

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/chat/sessions/{sessionId}:
 *   put:
 *     summary: Update chat session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               contractName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session updated successfully
 *       404:
 *         description: Session not found
 */
router.put('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, contractName } = req.body;
    const userId = req.user.id;

    const session = await ChatSessionStorage.findById(sessionId);

    if (!session || session.userId !== userId) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Chat session not found or access denied'
      });
    }

    const updates = {};
    if (title) updates.title = title;
    if (contractName) updates.contractName = contractName;

    const updatedSession = await ChatSessionStorage.update(sessionId, updates);

    res.json({
      session: updatedSession,
      message: 'Session updated successfully'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to update session',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/chat/sessions/{sessionId}:
 *   delete:
 *     summary: Delete chat session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deleted successfully
 *       404:
 *         description: Session not found
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await ChatSessionStorage.findById(sessionId);

    if (!session || session.userId !== userId) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Chat session not found or access denied'
      });
    }

    await ChatSessionStorage.delete(sessionId);

    res.json({
      message: 'Chat session deleted successfully',
      sessionId
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete session',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/chat/suggested-questions:
 *   get:
 *     summary: Get suggested questions for a contract (public endpoint)
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: contractAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Contract address to get suggestions for
 *       - in: query
 *         name: contractChain
 *         required: true
 *         schema:
 *           type: string
 *         description: Contract chain to get suggestions for
 *     responses:
 *       200:
 *         description: Suggested questions retrieved successfully
 *       400:
 *         description: Missing required parameters
 */
router.get('/suggested-questions', async (req, res) => {
  try {
    const { contractAddress, contractChain } = req.query;

    if (!contractAddress || !contractChain) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'contractAddress and contractChain are required'
      });
    }

    // Use authenticated user if available, otherwise anonymous
    const userId = req.user?.id || 'anonymous';

    // Get contract context
    const contractContext = await ChatAIService.getContractContext(
      userId, 
      contractAddress, 
      contractChain
    );

    // Generate suggested questions
    const questions = await ChatAIService.generateSuggestedQuestions(contractContext);

    res.json({
      questions: questions,
      contractAddress,
      contractChain,
      total: questions.length,
      aiEnabled: ChatAIService.isEnabled()
    });

  } catch (error) {
    console.error('Suggested questions error:', error);
    res.status(500).json({
      error: 'Failed to generate suggested questions',
      message: error.message
    });
  }
});

export default router;