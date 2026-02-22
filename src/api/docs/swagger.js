/**
 * Swagger/OpenAPI Configuration
 * Complete API documentation
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MetaGauge API',
      version: '1.0.0',
      description: 'Multi-Chain Smart Contract Analytics Platform API',
      contact: {
        name: 'MetaGauge Support',
        email: 'support@metagauge.io',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://api.metagauge.io',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
              },
              description: 'Detailed error information',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            name: {
              type: 'string',
            },
            tier: {
              type: 'number',
              enum: [0, 1, 2, 3],
              description: '0=Free, 1=Starter, 2=Pro, 3=Enterprise',
            },
            walletAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Contract: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
            },
            chain: {
              type: 'string',
              enum: ['ethereum', 'lisk', 'starknet'],
            },
            name: {
              type: 'string',
            },
            abi: {
              type: 'array',
            },
            isActive: {
              type: 'boolean',
            },
          },
        },
        Analysis: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            contractId: {
              type: 'string',
              format: 'uuid',
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed'],
            },
            progress: {
              type: 'number',
              minimum: 0,
              maximum: 100,
            },
            results: {
              type: 'object',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and registration',
      },
      {
        name: 'Users',
        description: 'User profile management',
      },
      {
        name: 'Contracts',
        description: 'Smart contract configuration',
      },
      {
        name: 'Analysis',
        description: 'Contract analysis operations',
      },
      {
        name: 'Onboarding',
        description: 'Contract onboarding flow',
      },
      {
        name: 'Chat',
        description: 'AI chat assistant',
      },
      {
        name: 'Subscription',
        description: 'Subscription management',
      },
      {
        name: 'Monitoring',
        description: 'Continuous monitoring',
      },
      {
        name: 'Backup',
        description: 'Database backup operations',
      },
    ],
  },
  apis: ['./src/api/routes/*.js'], // Path to API routes
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
