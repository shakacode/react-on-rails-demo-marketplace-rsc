// CSS-only carrier pack for the RSC *server-component* page two (/css-demo/two/rsc-server).
// See css_demo_one.js for the rationale. Page two's exact CSS set is cssShared + cssB
// (no cssA). cssShared is shared with page one and is factored into a single chunk by
// splitChunks {chunks:'all'}, so it downloads once per page and is cached across pages.
//
// Import order matters: shared first, page-specific second (preserve the cascade).
// Side-effect imports only; link via `stylesheet_pack_tag`, never `javascript_pack_tag`.
import '../components/css-demo/cssShared.css';
import '../components/css-demo/cssB.css';
