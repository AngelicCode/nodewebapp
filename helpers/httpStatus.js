const HTTP_STATUS = {

  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

const RESPONSE_MESSAGES = {

  [HTTP_STATUS.OK]: "Request successful",
  [HTTP_STATUS.CREATED]: "Resource created successfully",
  [HTTP_STATUS.NO_CONTENT]: "No content",

  [HTTP_STATUS.BAD_REQUEST]: "Invalid request data provided",
  [HTTP_STATUS.UNAUTHORIZED]: "Access denied. Authentication required",
  [HTTP_STATUS.FORBIDDEN]: "You don't have permission to access this resource",
  [HTTP_STATUS.NOT_FOUND]: (resource = "Resource") => `${resource} not found`,
  [HTTP_STATUS.METHOD_NOT_ALLOWED]: "HTTP method not allowed for this endpoint",
  [HTTP_STATUS.CONFLICT]: (resource = "Resource") => `${resource} already exists`,
  [HTTP_STATUS.UNPROCESSABLE_ENTITY]: "Validation failed. Please check your input",
  [HTTP_STATUS.TOO_MANY_REQUESTS]: "Too many requests. Please try again later",

  [HTTP_STATUS.INTERNAL_SERVER_ERROR]: "An unexpected error occurred on the server",
  [HTTP_STATUS.SERVICE_UNAVAILABLE]: "Service temporarily unavailable. Please try again later",
};

const getMessage = (statusCode, dynamicParam = null) => {
  const message = RESPONSE_MESSAGES[statusCode];
  
  if (typeof message === 'function') {
    return message(dynamicParam);
  }
  
  return message;
};

module.exports = {
  HTTP_STATUS,
  RESPONSE_MESSAGES,
  getMessage
};