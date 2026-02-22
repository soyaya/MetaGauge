/**
 * Input validation schemas using Joi
 * Centralized validation for all API endpoints
 */

import Joi from 'joi';

// Common patterns
const ethereumAddress = Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).message('Invalid Ethereum address format');
const email = Joi.string().email().message('Invalid email format');
const uuid = Joi.string().uuid().message('Invalid UUID format');
const chain = Joi.string().valid('ethereum', 'lisk', 'starknet').message('Invalid chain. Must be ethereum, lisk, or starknet');

// Auth schemas
export const authSchemas = {
  register: Joi.object({
    email: email.required(),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters',
    }),
    name: Joi.string().min(2).max(100).optional(),
  }),

  login: Joi.object({
    email: email.required(),
    password: Joi.string().required(),
  }),
};

// Contract schemas
export const contractSchemas = {
  create: Joi.object({
    address: ethereumAddress.required(),
    chain: chain.required(),
    name: Joi.string().min(1).max(100).required(),
    abi: Joi.alternatives().try(
      Joi.string(),
      Joi.array()
    ).optional(),
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    abi: Joi.alternatives().try(
      Joi.string(),
      Joi.array()
    ).optional(),
    isActive: Joi.boolean().optional(),
  }).min(1),
};

// Analysis schemas
export const analysisSchemas = {
  start: Joi.object({
    contractId: uuid.optional(),
    contractAddress: ethereumAddress.optional(),
    chain: chain.optional(),
    blockRange: Joi.object({
      start: Joi.number().integer().min(0).optional(),
      end: Joi.number().integer().min(0).optional(),
    }).optional(),
  }).or('contractId', 'contractAddress'),

  interpret: Joi.object({
    question: Joi.string().min(1).max(500).optional(),
  }),
};

// User schemas
export const userSchemas = {
  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: email.optional(),
  }).min(1),

  walletAddress: Joi.object({
    walletAddress: ethereumAddress.required(),
  }),

  syncSubscription: Joi.object({
    walletAddress: ethereumAddress.required(),
  }),
};

// Chat schemas
export const chatSchemas = {
  createSession: Joi.object({
    contractId: uuid.optional(),
    contractAddress: ethereumAddress.optional(),
    chain: chain.optional(),
  }),

  sendMessage: Joi.object({
    sessionId: uuid.required(),
    message: Joi.string().min(1).max(1000).required(),
  }),
};

// Onboarding schemas
export const onboardingSchemas = {
  start: Joi.object({
    contractAddress: ethereumAddress.required(),
    contractChain: chain.required(),
    contractName: Joi.string().min(1).max(100).required(),
    abi: Joi.alternatives().try(
      Joi.string(),
      Joi.array()
    ).optional(),
  }),
};

// Alert schemas
export const alertSchemas = {
  create: Joi.object({
    contractId: uuid.required(),
    type: Joi.string().valid(
      'transaction_volume',
      'user_activity',
      'gas_spike',
      'error_rate',
      'custom'
    ).required(),
    threshold: Joi.number().required(),
    condition: Joi.string().valid('above', 'below', 'equals').required(),
    enabled: Joi.boolean().optional(),
  }),

  update: Joi.object({
    threshold: Joi.number().optional(),
    condition: Joi.string().valid('above', 'below', 'equals').optional(),
    enabled: Joi.boolean().optional(),
  }).min(1),
};

// Monitoring schemas
export const monitoringSchemas = {
  start: Joi.object({
    contractId: uuid.required(),
    interval: Joi.number().integer().min(60).max(3600).optional(), // 1 min to 1 hour
  }),
};

// Subscription schemas
export const subscriptionSchemas = {
  verify: Joi.object({
    transactionHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
    walletAddress: ethereumAddress.required(),
  }),
};

export default {
  authSchemas,
  contractSchemas,
  analysisSchemas,
  userSchemas,
  chatSchemas,
  onboardingSchemas,
  alertSchemas,
  monitoringSchemas,
  subscriptionSchemas,
};
