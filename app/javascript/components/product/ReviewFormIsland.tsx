'use client';

// Phase 1 of issue #244: React 19 primitives-only review form.
//
// A real form — using ONLY React 19 built-in APIs (useActionState,
// useFormStatus, useOptimistic) — that POSTs a user-authored review to the
// plain Rails write endpoint, then asks the enclosing <RSCRoute> to refetch
// so the fresh review appears with no navigation.
//
// No form library: zero extra dependencies. This is the baseline that every
// library row in Phase 2 must beat.
//
// The form submits to POST /products/:product_id/reviews with the
// FormResponders 422 shape ({ errors: { field: [msgs] } }) for validation.
// The form-reset gotcha (React #29034) is handled by: (1) returning submitted
// values in action state, and (2) keying the <form> on a submission counter so
// React remounts the fields and applies the new defaultValue on error.

import React, { useActionState, useOptimistic, useRef, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useCurrentRSCRoute } from 'react-on-rails-pro/RSCRoute';
import { csrfToken } from '../../utils/csrfToken';

interface Props {
  productId: number;
  // Same scope semantics as ReviewMutationIsland: 'page' (default) refetches
  // the whole ProductPageRSC tree; 'section' refetches only the nested
  // ProductReviewsSectionRSC. Test ids gain a '-section' suffix so both
  // instances stay addressable on one page.
  scope?: 'page' | 'section';
}

// ── Form state ──────────────────────────────────────────────────────────────

type FormState = {
  errors: Record<string, string[]>;
  // Preserve submitted values so defaultValue can repopulate fields after the
  // React 19 uncontrolled-field reset (React #29034). The formKey counter
  // forces a remount so React applies the new defaultValue to fresh DOM nodes.
  values: Record<string, string | number>;
  formKey: number;
  success: boolean;
  lastReviewId: number | null;
};

const initialFormState: FormState = {
  errors: {},
  values: {},
  formKey: 0,
  success: false,
  lastReviewId: null,
};

// ── Optimistic review (inline confirmation) ─────────────────────────────────

interface OptimisticReview {
  reviewer_name: string;
  rating: number;
  title: string;
}

// ── Submit button — useFormStatus must live in a child of <form> ────────────

function SubmitButton({ testIdSuffix }: { testIdSuffix: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-testid={`review-form-submit${testIdSuffix}`}
      className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Posting review…' : 'Post Review'}
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function ReviewFormIsland({ productId, scope = 'page' }: Props) {
  const testIdSuffix = scope === 'section' ? '-section' : '';
  const { refetch, retry, refetchError, clearRefetchError } = useCurrentRSCRoute();
  const [isRefetching, startRefetchTransition] = useTransition();
  const [localRefetchError, setLocalRefetchError] = React.useState<string | null>(null);

  // Synchronous double-submit guard: render-state can lag one frame between
  // the POST settling and the transition's isPending flipping.
  const postInFlightRef = useRef(false);

  // Optimistic: show the submitted review inline as immediate feedback while
  // the server round-trips. The main server-rendered ReviewsList updates via
  // refetch; this is a small inline confirmation only.
  const [optimisticReviews, addOptimisticReview] = useOptimistic<OptimisticReview[], OptimisticReview>(
    [],
    (current, newReview) => [newReview, ...current],
  );

  const runRefetch = (doFetch: () => Promise<unknown>) => {
    setLocalRefetchError(null);
    startRefetchTransition(async () => {
      try {
        await doFetch();
      } catch (e) {
        setLocalRefetchError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      } finally {
        postInFlightRef.current = false;
      }
    });
  };

  // useActionState action: (previousState, formData) => nextState
  const [formState, formAction] = useActionState(
    async (prev: FormState, formData: FormData): Promise<FormState> => {
      if (postInFlightRef.current) return prev;
      postInFlightRef.current = true;

      const reviewData = {
        reviewer_name: (formData.get('reviewer_name') as string) ?? '',
        rating: Number(formData.get('rating') ?? 5),
        title: (formData.get('title') as string) ?? '',
        comment: (formData.get('comment') as string) ?? '',
      };

      // Optimistic: show the review inline immediately.
      addOptimisticReview({
        reviewer_name: reviewData.reviewer_name,
        rating: reviewData.rating,
        title: reviewData.title,
      });

      try {
        // POST to the #245 write endpoint.
        const response = await fetch(`/products/${productId}/reviews`, {
          method: 'POST',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
          body: JSON.stringify({
            review: {
              ...reviewData,
              // Pin helpful_count above the seeded maximum (120) so the new
              // review enters the visible top_reviews(5) window.
              helpful_count: 500,
            },
          }),
        });

        // FormResponders 422: { errors: { field: [msgs] } }
        if (!response.ok) {
          let errors: Record<string, string[]> = {};
          try {
            const body = (await response.json()) as { errors?: Record<string, string[]> };
            errors = body.errors ?? {};
          } catch {
            errors = { _base: [`Server responded with ${response.status}`] };
          }
          postInFlightRef.current = false;
          // Bump formKey so React remounts the <form>, applying the new
          // defaultValue to fresh DOM nodes (React #29034 workaround).
          return {
            errors,
            values: reviewData,
            formKey: prev.formKey + 1,
            success: false,
            lastReviewId: null,
          };
        }

        // Parse { id: number } from the 201 response.
        let reviewId: number;
        try {
          const body = (await response.json()) as { id?: unknown };
          if (typeof body.id !== 'number') throw new Error('response body lacked a numeric id');
          reviewId = body.id;
        } catch (e) {
          postInFlightRef.current = false;
          return {
            errors: { _base: [`POST succeeded but the response was unusable — ${e instanceof Error ? e.message : String(e)}`] },
            values: {},
            formKey: prev.formKey + 1,
            success: false,
            lastReviewId: null,
          };
        }

        // Refetch the server-rendered page/section to show the real review.
        // Await the refetch inside this action so isPending stays true and the
        // optimistic preview remains visible until the real data arrives.
        try {
          await refetch();
        } catch (e) {
          setLocalRefetchError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        } finally {
          postInFlightRef.current = false;
        }

        return {
          errors: {},
          values: {},
          formKey: prev.formKey + 1,
          success: true,
          lastReviewId: reviewId,
        };
      } catch (e) {
        postInFlightRef.current = false;
        return {
          errors: { _base: [e instanceof Error ? `${e.name}: ${e.message}` : String(e)] },
          values: reviewData,
          formKey: prev.formKey + 1,
          success: false,
          lastReviewId: null,
        };
      }
    },
    initialFormState,
  );

  return (
    <div
      data-testid={`review-form-island${testIdSuffix}`}
      className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm"
    >
      <p className="mb-3 font-medium text-indigo-900">
        Issue #244 Phase 1: React 19 built-ins review form (no form library)
      </p>

      {/* key={formState.formKey} forces a remount on each submission so React
           applies the new defaultValue to fresh DOM nodes (React #29034 fix). */}
      <form action={formAction} key={formState.formKey} data-testid={`review-form${testIdSuffix}`} className="space-y-3">
        {/* Reviewer name (required) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Your Name *
            <input
              name="reviewer_name"
              defaultValue={formState.values.reviewer_name ?? ''}
              maxLength={100}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              autoComplete="name"
            />
          </label>
          {formState.errors.reviewer_name && (
            <p
              className="mt-1 text-sm text-red-600"
              data-testid={`review-form-error-reviewer_name${testIdSuffix}`}
            >
              {formState.errors.reviewer_name[0]}
            </p>
          )}
        </div>

        {/* Rating (required) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Rating *
            <select
              name="rating"
              defaultValue={formState.values.rating ?? '5'}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {'⭐'.repeat(n)} ({n})
                </option>
              ))}
            </select>
          </label>
          {formState.errors.rating && (
            <p
              className="mt-1 text-sm text-red-600"
              data-testid={`review-form-error-rating${testIdSuffix}`}
            >
              {formState.errors.rating[0]}
            </p>
          )}
        </div>

        {/* Title (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Title
            <input
              name="title"
              defaultValue={formState.values.title ?? ''}
              maxLength={200}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        </div>

        {/* Comment (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Comment
            <textarea
              name="comment"
              defaultValue={formState.values.comment ?? ''}
              maxLength={5000}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        </div>

        <SubmitButton testIdSuffix={testIdSuffix} />
      </form>

      {/* Optimistic review confirmation — stays visible while isPending because
           the action awaits refetch, so there's no gap between optimistic and real. */}
      {optimisticReviews.length > 0 && (
        <div className="mt-3 space-y-1">
          {optimisticReviews.map((r, i) => (
            <p key={i} className="text-indigo-700 opacity-60">
              {'⭐'.repeat(r.rating)} by {r.reviewer_name}
              {r.title && ` — "${r.title}"`} (saving…)
            </p>
          ))}
        </div>
      )}

      {/* Status messages */}
      <div className="mt-2" aria-live="polite">
        <span data-testid={`review-form-status${testIdSuffix}`}>
          {formState.success && !isRefetching && !refetchError && !localRefetchError &&
            `✅ Review #${formState.lastReviewId} posted and refetched.`}
          {formState.success && isRefetching &&
            `Posted review #${formState.lastReviewId}; refreshing ${scope === 'section' ? 'section' : 'page'}…`}
          {formState.success && !isRefetching && (refetchError || localRefetchError) &&
            `Posted review #${formState.lastReviewId}; the refetch failed — see below.`}
          {!formState.success && Object.keys(formState.errors).length > 0 &&
            'Please fix the errors above.'}
        </span>
      </div>

      {/* Base / network errors */}
      {formState.errors._base && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          <p>{formState.errors._base[0]}</p>
        </div>
      )}

      {/* Refetch error recovery */}
      {(refetchError || localRefetchError) && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800" data-testid={`review-form-refetch-error${testIdSuffix}`}>
          <p className="font-medium">Refetch failed{refetchError ? ` — ${refetchError.message}` : ''}</p>
          {localRefetchError && !refetchError && <p>{localRefetchError}</p>}
          <div className="mt-1 flex gap-3">
            <button type="button" className="underline" onClick={() => runRefetch(retry)}>
              Retry
            </button>
            {refetchError && (
              <button type="button" className="underline" onClick={clearRefetchError}>
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
