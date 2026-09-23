// GraphQL queries for the Apollo × RSC demo (issue #255).

import { gql } from '@apollo/client';

// L1 query: fetches everything server-side. No data reaches the browser
// through Apollo — it's all rendered into RSC HTML.
export const GET_PRODUCT_FULL = gql`
  query GetProductFull($id: ID) {
    product(id: $id) {
      id
      name
      description
      price
      originalPrice
      category
      brand
      sku
      images {
        url
        alt
        position
      }
      specs
      features
      averageRating
      reviewCount
      stockQuantity
      inStock
      discountPercentage
      reviews(limit: 5) {
        id
        rating
        title
        comment
        reviewerName
        verifiedPurchase
        helpfulCount
        createdAt
      }
      reviewStats {
        averageRating
        totalReviews
        distribution {
          stars
          count
          percentage
        }
      }
      relatedProducts(limit: 4) {
        id
        name
        price
        originalPrice
        category
        brand
        images {
          url
          alt
          position
        }
        averageRating
        reviewCount
        inStock
        discountPercentage
      }
    }
  }
`;

// L2 query: just reviews, preloaded via PreloadQuery and transported
// through Flight to the client island for hydration.
export const GET_PRODUCT_REVIEWS = gql`
  query GetProductReviews($id: ID!) {
    product(id: $id) {
      reviews(limit: 5) {
        id
        rating
        title
        comment
        reviewerName
        verifiedPurchase
        helpfulCount
        createdAt
      }
      reviewStats {
        averageRating
        totalReviews
        distribution {
          stars
          count
          percentage
        }
      }
    }
  }
`;
