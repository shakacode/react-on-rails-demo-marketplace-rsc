'use client';

// Phase 2 of issue #244: TanStack Form review form (@tanstack/react-form).
//
// Same review form as Phase 1, but using TanStack Form — the newest library
// with the best TypeScript inference and smallest bundle (~9.6 kB gzipped).
// TanStack Form uses onSubmit (not <form action>), so it cannot use
// useFormStatus or useActionState. It uses controlled inputs via form.Field
// render props, which means the React #29034 form-reset gotcha doesn't apply.
//
// Server errors are tracked in a separate useState (not setFieldMeta, which
// has known bugs: TanStack/form#1260, #1386) and displayed alongside
// TanStack's client-side validation errors.

import React, { useRef, useState, useTransition } from 'react';
import { useForm } from '@tanstack/react-form';
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
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().default(''),
  comment: z.string().max(5000).optional().default(''),
});

// ── Main component ──────────────────────────────────────────────────────────

export function ReviewFormTanStackIsland({ productId, scope = 'page' }: Props) {
  const testIdSuffix = scope === 'section' ? '-section' : '';
  const { refetch, refetchError, clearRefetchError } = useCurrentRSCRoute();
  const [isRefetching, startRefetchTransition] = useTransition();
  const [localRefetchError, setLocalRefetchError] = React.useState<string | null>(null);
  const [successReviewId, setSuccessReviewId] = useState<number | null>(null);
  // Server errors tracked separately (setFieldMeta has bugs: #1260, #1386).
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const postInFlightRef = useRef(false);

  const form = useForm({
    defaultValues: {
      reviewer_name: '',
      rating: 5,
      title: '',
      comment: '',
    },
    onSubmit: async ({ value }) => {
      if (postInFlightRef.current) return;
      postInFlightRef.current = true;
      setSuccessReviewId(null);
      setServerErrors({});

      try {
        // Client-side validation via zod.
        const result = reviewSchema.safeParse(value);
        if (!result.success) {
          const fieldErrors: Record<string, string[]> = {};
          for (const issue of result.error.issues) {
            const field = issue.path[0] as string;
            fieldErrors[field] = fieldErrors[field] ?? [];
            fieldErrors[field].push(issue.message);
          }
          setServerErrors(fieldErrors);
          postInFlightRef.current = false;
          return;
        }

        const response = await fetch(`/products/${productId}/reviews`, {
          method: 'POST',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
          body: JSON.stringify({
            review: { ...result.data, helpful_count: 500 },
          }),
        });

        // FormResponders 422: store in serverErrors state.
        if (!response.ok) {
          try {
            const body = (await response.json()) as { errors?: Record<string, string[]> };
            setServerErrors(body.errors ?? {});
          } catch {
            setServerErrors({ _base: [`Server responded with ${response.status}`] });
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
          setServerErrors({
            _base: [`POST succeeded but response was unusable — ${e instanceof Error ? e.message : String(e)}`],
          });
          postInFlightRef.current = false;
          return;
        }

        // Refetch the server-rendered page to show the real review.
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

        setSuccessReviewId(reviewId);
        form.reset(); // Clear the form on success.
      } catch (e) {
        setServerErrors({
          _base: [e instanceof Error ? `${e.name}: ${e.message}` : String(e)],
        });
        postInFlightRef.current = false;
      }
    },
  });

  const busy = form.state.isSubmitting || isRefetching;

  return (
    <div
      data-testid={`review-form-tanstack-island${testIdSuffix}`}
      className="mb-6 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm"
    >
      <p className="mb-3 font-medium text-purple-900">
        Issue #244 Phase 2: TanStack Form review form (@tanstack/react-form)
      </p>

      {/* TanStack Form uses onSubmit — NOT <form action>. useFormStatus will not work. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        data-testid={`review-form-tanstack${testIdSuffix}`}
        className="space-y-3"
      >
        {/* Reviewer name (required) */}
        <form.Field name="reviewer_name">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Your Name *
                <input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  maxLength={100}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  autoComplete="name"
                />
              </label>
              {serverErrors.reviewer_name && (
                <p
                  className="mt-1 text-sm text-red-600"
                  data-testid={`review-form-tanstack-error-reviewer_name${testIdSuffix}`}
                >
                  {serverErrors.reviewer_name[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Rating (required) */}
        <form.Field name="rating">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Rating *
                <select
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {'⭐'.repeat(n)} ({n})
                    </option>
                  ))}
                </select>
              </label>
              {serverErrors.rating && (
                <p
                  className="mt-1 text-sm text-red-600"
                  data-testid={`review-form-tanstack-error-rating${testIdSuffix}`}
                >
                  {serverErrors.rating[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Title (optional) */}
        <form.Field name="title">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Title
                <input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  maxLength={200}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </label>
            </div>
          )}
        </form.Field>

        {/* Comment (optional) */}
        <form.Field name="comment">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Comment
                <textarea
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  maxLength={5000}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </label>
            </div>
          )}
        </form.Field>

        {/* TanStack Form uses its own isSubmitting — not useFormStatus */}
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          data-testid={`review-form-tanstack-submit${testIdSuffix}`}
          className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {form.state.isSubmitting ? 'Posting review…' : isRefetching ? 'Refreshing…' : 'Post Review'}
        </button>
      </form>

      {/* Status messages */}
      <div className="mt-2" aria-live="polite">
        <span data-testid={`review-form-tanstack-status${testIdSuffix}`}>
          {successReviewId && !isRefetching && !refetchError && !localRefetchError &&
            `✅ Review #${successReviewId} posted and refetched.`}
          {successReviewId && isRefetching &&
            `Posted review #${successReviewId}; refreshing…`}
          {successReviewId && !isRefetching && (refetchError || localRefetchError) &&
            `Posted review #${successReviewId}; the refetch failed — see below.`}
          {Object.keys(serverErrors).length > 0 && !serverErrors._base &&
            'Please fix the errors above.'}
        </span>
      </div>

      {/* Base / network errors */}
      {serverErrors._base && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          <p>{serverErrors._base[0]}</p>
        </div>
      )}

      {/* Refetch error recovery */}
      {(refetchError || localRefetchError) && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800" data-testid={`review-form-tanstack-refetch-error${testIdSuffix}`}>
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
