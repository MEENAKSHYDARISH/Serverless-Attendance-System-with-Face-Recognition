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
  let groups = claims['cognito:groups'];
  
  console.log('hasAdminAccess - raw groups:', groups);
  
  // Handle groups as a JSON string like "[admin]"
  if (typeof groups === 'string') {
    try {
      groups = JSON.parse(groups);
    } catch {
      // If not valid JSON, treat as comma-separated string
      groups = groups.split(',').map(x => x.trim().replace(/[\[\]]/g, ''));
    }
  }
  
  console.log('hasAdminAccess - parsed groups:', groups);
  
  if (!groups) return false;
  if (Array.isArray(groups)) return groups.includes('admin');
  return false;
}

module.exports = { getClaims, hasAdminAccess };
