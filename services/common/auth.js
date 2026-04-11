function getClaims(event) {
  return event?.requestContext?.authorizer?.jwt?.claims || {};
}

function hasAdminAccess(event) {
  const claims = getClaims(event);
  const groups = claims['cognito:groups'];
  if (!groups) return false;
  if (Array.isArray(groups)) return groups.includes('admin');
  return String(groups).split(',').map((x) => x.trim()).includes('admin');
}

module.exports = { getClaims, hasAdminAccess };
