// CSS-only carrier pack for the RSC *server-component* page one (/css-demo/one/rsc-server).
//
// Server components' CSS lives only in the server/RSC bundle and never reaches the
// browser, so the streamed markup renders unstyled. This pack re-imports the SAME CSS
// the server components use (cssShared + cssA, page one's exact set — no cssB) into a
// CLIENT entry, so the bytes get extracted into a client chunk that the controller links
// in the <head> via `append_stylesheet_pack_tag('css_demo_one')`.
//
// Import order matters: shared first, page-specific second (preserve the cascade).
// Side-effect imports only (global CSS) — never `import styles from ...`.
// This entry carries NO runtime JS; render it with `stylesheet_pack_tag` only, never
// `javascript_pack_tag` (we don't want to ship an empty script).
import '../components/css-demo/cssShared.css';
import '../components/css-demo/cssA.css';
