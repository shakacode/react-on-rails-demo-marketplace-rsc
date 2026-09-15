// C5 (issue #245): registers the nested reviews-section server component in
// every generated bundle. The RSC bundle needs it registered by name so
// generateRSCPayload (initial render) and the payload door (section refetch)
// can render "ProductReviewsSectionRSC"; the client/server registrations are
// the standard auto-generated-pack wrappers and are unused while the
// component is only ever mounted through the nested <RSCRoute>.
export { default } from '../components/product/ProductReviewsSectionRSC';
