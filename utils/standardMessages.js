/**
 * Standard HTTP Response Messages
 */

module.exports = {
  message: {
    "SUCCESS": {
      code: 200,
      message: "Success"
    },
    "CREATED": {
      code: 201,
      message: "Resource created successfully"
    },
    "BAD_REQUEST": {
      code: 400,
      message: "Bad request"
    },
    "UNAUTHORIZED": {
      code: 401,
      message: "Unauthorized access"
    },
    "FORBIDDEN": {
      code: 403,
      message: "Forbidden"
    },
    "NOT_FOUND": {
      code: 404,
      message: "Resource not found"
    },
    "CONFLICT": {
      code: 409,
      message: "Resource conflict"
    },
    "VALIDATION_ERROR": {
      code: 411,
      message: "Validation error"
    },
    "INTERNAL_ERROR": {
      code: 500,
      message: "Internal server error"
    },
    "INVALID_ROUTE": {
      code: 404,
      message: "Invalid route"
    },
    "INVALID_OTP": {
      code: 601,
      message: "Invalid OTP"
    },
    "OTP_EXPIRED": {
      code: 602,
      message: "OTP has expired"
    },
    "MAX_ATTEMPTS": {
      code: 603,
      message: "Maximum OTP attempts exceeded"
    }
  }
};
