// Registers the PPR prerender/resume APIs (react-dom/static.node + server.node) with
// react-on-rails-pro so ppr_react_component works. Requires react and react-dom >= 19.2.7 < 20.
import "react-on-rails-pro/pprSupport";

// import statement added by react_on_rails:generate_packs rake task
import "./../generated/server-bundle-generated.js";

console.log("[LocalHub Demo] Server bundle loaded");
