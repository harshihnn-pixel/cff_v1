// Security log: failed logins, refused permissions and rate limits are written to the server log
// (one line each, no passwords or tokens), so unusual activity can be spotted.
function securityLog(event, req, details = {}){
  const who = req && req.user ? req.user.id : "anonymous";
  const ip = req ? (req.ip || "") : "";
  const path = req ? (req.originalUrl || req.url || "").split("?")[0] : "";
  console.warn(`[CFF security] ${new Date().toISOString()} ${event} user=${who} ip=${ip} path=${path} ${JSON.stringify(details)}`);
}
module.exports = { securityLog };
