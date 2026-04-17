const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "*",
  },
  body: JSON.stringify(body),
});

const badRequest = (message) => json(400, { message });
const unauthorized = (message) =>
  json(401, { message: message || "Unauthorized" });
const forbidden = (message) => json(403, { message: message || "Forbidden" });

module.exports = { json, badRequest, unauthorized, forbidden };
