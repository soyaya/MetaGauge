/**
 * Validation middleware factory
 * Creates middleware to validate request body, params, or query
 */

export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'body' ? req.body : 
                 source === 'params' ? req.params : 
                 req.query;

    const { error, value } = schema.validate(data, {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    // Replace request data with validated and sanitized data
    if (source === 'body') req.body = value;
    else if (source === 'params') req.params = value;
    else req.query = value;

    next();
  };
};

export default validate;
