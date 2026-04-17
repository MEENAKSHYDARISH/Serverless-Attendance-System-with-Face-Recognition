function getClaims(event) {
  // Try multiple possible locations where API Gateway puts JWT claims
  const claims = 
    event?.requestContext?.authorizer?.jwt?.claims ||
    event?.requestContext?.authorizer?.claims ||
    event?.requestContext?.authorizer ||
    {};
  
  console.log('getClaims - Full authorizer:', JSON.stringify(event?.requestContext?.authorizer));
  console.log('getClaims - Extracted claims:', JSON.stringify(claims));
  
  return claims;
}

function hasAdminAccess(event) {
  const claims = getClaims(event);
  const groups = claims['cognito:groups'];
  
  console.log('hasAdminAccess - groups found:', groups);
  console.log('hasAdminAccess - is admin?:', Array.isArray(groups) ? groups.includes('admin') : String(groups || '').split(',').map(x => x.trim()).includes('admin'));
  
  if (!groups) return false;
  if (Array.isArray(groups)) return groups.includes('admin');
  return String(groups).split(',').map((x) => x.trim()).includes('admin');
}

module.exports = { getClaims, hasAdminAccess };
