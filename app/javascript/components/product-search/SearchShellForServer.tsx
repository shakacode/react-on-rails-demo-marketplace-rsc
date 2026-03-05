'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for SearchShell components.
// Server components import this file; client components import SearchShell directly.
export {
  SearchShellHeader,
  SearchShellSort,
  SearchShellFilters,
  SearchShellPagination,
  AddToCartButton,
  CompareButton,
  CompareBar,
  SearchShellActiveFilters,
  SearchShellTags,
  SearchShellBrandHighlights,
  CardStarRating,
  CardReviewSnippets,
  CardFeaturesList,
  CardProductTags,
} from './SearchShell';
