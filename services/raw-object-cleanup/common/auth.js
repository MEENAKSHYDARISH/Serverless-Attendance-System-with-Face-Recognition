function hasAdminAccess(event) {
  try {
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;

    if (!authHeader) return false;

    const token = authHeader.split(" ")[1];

    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );

    console.log("DECODED TOKEN:", payload);

    let groups = payload["cognito:groups"];

    if (!groups) return false;

    if (typeof groups === "string") {
      groups = [groups];
    }

    return groups.includes("admin");
  } catch (err) {
    console.error("AUTH ERROR:", err);
    return false;
  }
}

module.exports = { hasAdminAccess };
