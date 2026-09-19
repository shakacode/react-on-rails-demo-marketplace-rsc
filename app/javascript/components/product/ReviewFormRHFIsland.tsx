'use client';

// Phase 2 of issue #244: react-hook-form + zod review form.
//
// Same review form as Phase 1, but using react-hook-form (RHF) — the most
// popular React form library (~40-58M downloads/week). RHF uses onSubmit (not
// <form action>), so it cannot use useFormStatus or useActionState. It tracks
// its own isSubmitting flag and uses controlled inputs via register(), which
// means the React #29034 form-reset gotcha does not apply.
//
// Key difference from Phase 1: RHF owns form state entirely on the client.
// Server errors are injected via setError(). No formKey workaround needed.

import React, { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCurrentRSCRoute } from 'react-on-rails-pro/RSCRoute';
import { csrfToken } from '../../utils/csrfToken';

interface Props {
  productId: number;
  scope?: 'page' | 'section';
}

// ── Validation schema ───────────────────────────────────────────────────────

const reviewSchema = z.object({
  reviewer_name: z.string().min(1, "can't be blank").max(100),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(200).optional().default(''),
  comment: z.string().max(5000).optional().default(''),
});

// ── Main component ──────────────────────────────────────────────────────────

export function ReviewFormRHFIsland({ productId, scope = 'page' }: Props) {
  const testIdSuffix = scope === 'section' ? '-section' : '';
  const { refetch, refetchError, clearRefetchError } = useCurrentRSCRoute();
  const [isRefetching, startRefetchTransition] = useTransition();
  const [localRefetchError, setLocalRefetchError] = React.useState<string | null>(null);
  const [successReviewId, setSuccessReviewId] = useState<number | null>(null);
  const postInFlightRef = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      reviewer_name: '',
      rating: 5,
      title: '',
      comment: '',
    },
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    if (postInFlightRef.current) return;
    postInFlightRef.current = true;
    setSuccessReviewId(null);

    try {
      const response = await fetch(`/products/${productId}/reviews`, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({
          review: { ...data, helpful_count: 500 },
        }),
      });

      // FormResponders 422: map Rails errors to RHF via setError().
      if (!response.ok) {
        try {
          const body = (await response.json()) as { errors?: Record<string, string[]> };
          const serverErrors = body.errors ?? {};
          for (const [field, messages] of Object.entries(serverErrors)) {
            setError(field as any, {
              type: 'server',
              message: (messages as string[])[0],
            });
          }
        } catch {
          setError('root', { type: 'server', message: `Server responded with ${response.status}` });
        }
        postInFlightRef.current = false;
        return;
      }

      // Parse { id: number } from the 201 response.
      let reviewId: number;
      try {
        const body = (await response.json()) as { id?: unknown };
        if (typeof body.id !== 'number') throw new Error('response body lacked a numeric id');
        reviewId = body.id;
      } catch (e) {
        setError('root', {
          type: 'server',
          message: `POST succeeded but response was unusable — ${e instanceof Error ? e.message : String(e)}`,
        });
        postInFlightRef.current = false;
        return;
      }

      // Refetch the server-rendered page to show the real review.
      // Must use startTransition so React keeps old content visible (without it,
      // refetch() suspends and the Suspense fallback flashes).
      setSuccessReviewId(reviewId);
      reset(); // Clear the form on success.
      setLocalRefetchError(null);
      startRefetchTransition(async () => {
        try {
          await refetch();
        } catch (e) {
          setLocalRefetchError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        } finally {
          postInFlightRef.current = false;
        }
      });
    } catch (e) {
      setError('root', {
        type: 'server',
        message: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      });
      postInFlightRef.current = false;
    }
  };

  const busy = isSubmitting || isRefetching;

  return (
    <div
      data-testid={`review-form-rhf-island${testIdSuffix}`}
      className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
    >
      <p className="mb-3 font-medium text-amber-900">
        Issue #244 Phase 2: react-hook-form + zod review form
      </p>

      {/* RHF uses onSubmit — NOT <form action>. useFormStatus will not work. */}
      <form
        onSubmit={(e) => handleSubmit(onSubmit)(e)}
        data-testid={`review-form-rhf${testIdSuffix}`}
        className="space-y-3"
      >
        {/* Reviewer name (required) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Your Name *
            <input
              {...register('reviewer_name')}
              maxLength={100}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              autoComplete="name"
            />
          </label>
          {errors.reviewer_name && (
            <p
              className="mt-1 text-sm text-red-600"
              data-testid={`review-form-rhf-error-reviewer_name${testIdSuffix}`}
            >
              {errors.reviewer_name.message}
            </p>
          )}
        </div>

        {/* Rating (required) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Rating *
            <select
              {...register('rating')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {'⭐'.repeat(n)} ({n})
                </option>
              ))}
            </select>
          </label>
          {errors.rating && (
            <p
              className="mt-1 text-sm text-red-600"
              data-testid={`review-form-rhf-error-rating${testIdSuffix}`}
            >
              {errors.rating.message}
            </p>
          )}
        </div>

        {/* Title (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Title
            <input
              {...register('title')}
              maxLength={200}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </label>
        </div>

        {/* Comment (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Comment
            <textarea
              {...register('comment')}
              maxLength={5000}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </label>
        </div>

        {/* RHF uses its own isSubmitting — not useFormStatus */}
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          data-testid={`review-form-rhf-submit${testIdSuffix}`}
          className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Posting review…' : isRefetching ? 'Refreshing…' : 'Post Review'}
        </button>
      </form>

      {/* Status messages */}
      <div className="mt-2" aria-live="polite">
        <span data-testid={`review-form-rhf-status${testIdSuffix}`}>
          {successReviewId && !isRefetching && !refetchError && !localRefetchError &&
            `✅ Review #${successReviewId} posted and refetched.`}
          {successReviewId && isRefetching &&
            `Posted review #${successReviewId}; refreshing…`}
          {successReviewId && !isRefetching && (refetchError || localRefetchError) &&
            `Posted review #${successReviewId}; the refetch failed — see below.`}
          {errors.root && (
            <span className="text-red-600">{errors.root.message}</span>
          )}
        </span>
      </div>

      {/* Refetch error recovery */}
      {(refetchError || localRefetchError) && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800" data-testid={`review-form-rhf-refetch-error${testIdSuffix}`}>
          <p className="font-medium">Refetch failed{refetchError ? ` — ${refetchError.message}` : ''}</p>
          {localRefetchError && !refetchError && <p>{localRefetchError}</p>}
          <button type="button" className="mt-1 underline" onClick={clearRefetchError}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
