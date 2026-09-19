'use client';

// Phase 2 of issue #244: Conform review form (@conform-to/react).
//
// Same review form as Phase 1, but using Conform — the library architecturally
// closest to React 19's <form action> model. Conform works natively with
// useActionState and useFormStatus, uses FormData (not controlled inputs), and
// handles the form-reset gotcha (React #29034) via lastResult repopulation.
//
// Key difference from Phase 1: Conform's `useForm({ lastResult })` manages
// field repopulation automatically — no formKey counter needed.

import React, { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useForm, getFormProps, getInputProps, getSelectProps, getTextareaProps } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod';
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

// ── Submit button — useFormStatus works because Conform uses <form action> ──

function SubmitButton({ testIdSuffix }: { testIdSuffix: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-testid={`review-form-conform-submit${testIdSuffix}`}
      className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Posting review…' : 'Post Review'}
    </button>
  );
}

// ── Action state type ───────────────────────────────────────────────────────

import type { SubmissionResult } from '@conform-to/react';

type ActionState = {
  status: 'idle' | 'success' | 'error';
  lastReviewId: number | null;
  submission?: SubmissionResult<string[]>;
  serverError?: string;
};

const initialState: ActionState = {
  status: 'idle',
  lastReviewId: null,
};

// ── Main component ──────────────────────────────────────────────────────────

export function ReviewFormConformIsland({ productId, scope = 'page' }: Props) {
  const testIdSuffix = scope === 'section' ? '-section' : '';
  const { refetch, refetchError, clearRefetchError } = useCurrentRSCRoute();
  const [localRefetchError, setLocalRefetchError] = React.useState<string | null>(null);
  const postInFlightRef = useRef(false);

  const [actionState, formAction, isPending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      if (postInFlightRef.current) return prev;
      postInFlightRef.current = true;

      // Client-side validation via Conform + zod.
      const submission = parseWithZod(formData, { schema: reviewSchema });
      if (submission.status !== 'success') {
        postInFlightRef.current = false;
        return {
          status: 'error',
          lastReviewId: null,
          submission: submission.reply(),
        };
      }

      const reviewData = submission.value;

      try {
        const response = await fetch(`/products/${productId}/reviews`, {
          method: 'POST',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
          body: JSON.stringify({
            review: { ...reviewData, helpful_count: 500 },
          }),
        });

        // FormResponders 422: map Rails errors to Conform's fieldErrors shape.
        if (!response.ok) {
          let fieldErrors: Record<string, string[]> = {};
          try {
            const body = (await response.json()) as { errors?: Record<string, string[]> };
            fieldErrors = body.errors ?? {};
          } catch {
            postInFlightRef.current = false;
            return {
              status: 'error',
              lastReviewId: null,
              serverError: `Server responded with ${response.status}`,
            };
          }
          postInFlightRef.current = false;
          return {
            status: 'error',
            lastReviewId: null,
            // Conform's reply({ fieldErrors }) preserves submitted values and
            // populates per-field errors — handles the React #29034 reset gotcha.
            submission: submission.reply({ fieldErrors }),
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
            status: 'error',
            lastReviewId: null,
            serverError: `POST succeeded but response was unusable — ${e instanceof Error ? e.message : String(e)}`,
          };
        }

        // Refetch the server-rendered page to show the real review.
        try {
          await refetch();
        } catch (e) {
          setLocalRefetchError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        } finally {
          postInFlightRef.current = false;
        }

        return {
          status: 'success',
          lastReviewId: reviewId,
          // resetForm: true clears the form on success.
          submission: submission.reply({ resetForm: true }),
        };
      } catch (e) {
        postInFlightRef.current = false;
        return {
          status: 'error',
          lastReviewId: null,
          serverError: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
        };
      }
    },
    initialState,
  );

  // Conform's useForm: lastResult drives field repopulation and error display.
  const [form, fields] = useForm({
    lastResult: actionState.submission,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: reviewSchema });
    },
    shouldValidate: 'onBlur',
    shouldRevalidate: 'onInput',
  });

  return (
    <div
      data-testid={`review-form-conform-island${testIdSuffix}`}
      className="mb-6 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm"
    >
      <p className="mb-3 font-medium text-teal-900">
        Issue #244 Phase 2: Conform review form (@conform-to/react)
      </p>

      <form
        action={formAction}
        {...getFormProps(form)}
        data-testid={`review-form-conform${testIdSuffix}`}
        className="space-y-3"
      >
        {/* Reviewer name (required) */}
        <div>
          <label htmlFor={fields.reviewer_name.id} className="block text-sm font-medium text-gray-700">
            Your Name *
          </label>
          <input
            {...getInputProps(fields.reviewer_name, { type: 'text' })}
            maxLength={100}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            autoComplete="name"
          />
          {fields.reviewer_name.errors && (
            <p
              className="mt-1 text-sm text-red-600"
              data-testid={`review-form-conform-error-reviewer_name${testIdSuffix}`}
            >
              {fields.reviewer_name.errors[0]}
            </p>
          )}
        </div>

        {/* Rating (required) */}
        <div>
          <label htmlFor={fields.rating.id} className="block text-sm font-medium text-gray-700">
            Rating *
          </label>
          <select
            {...getSelectProps(fields.rating)}
            defaultValue="5"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {'⭐'.repeat(n)} ({n})
              </option>
            ))}
          </select>
          {fields.rating.errors && (
            <p
              className="mt-1 text-sm text-red-600"
              data-testid={`review-form-conform-error-rating${testIdSuffix}`}
            >
              {fields.rating.errors[0]}
            </p>
          )}
        </div>

        {/* Title (optional) */}
        <div>
          <label htmlFor={fields.title.id} className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            {...getInputProps(fields.title, { type: 'text' })}
            maxLength={200}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Comment (optional) */}
        <div>
          <label htmlFor={fields.comment.id} className="block text-sm font-medium text-gray-700">
            Comment
          </label>
          <textarea
            {...getTextareaProps(fields.comment)}
            maxLength={5000}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <SubmitButton testIdSuffix={testIdSuffix} />
      </form>

      {/* Status messages */}
      <div className="mt-2" aria-live="polite">
        <span data-testid={`review-form-conform-status${testIdSuffix}`}>
          {actionState.status === 'success' && !refetchError && !localRefetchError &&
            `✅ Review #${actionState.lastReviewId} posted and refetched.`}
          {actionState.status === 'success' && (refetchError || localRefetchError) &&
            `Posted review #${actionState.lastReviewId}; the refetch failed — see below.`}
          {actionState.status === 'error' && actionState.submission &&
            'Please fix the errors above.'}
          {actionState.status === 'error' && actionState.serverError &&
            `Error: ${actionState.serverError}`}
        </span>
      </div>

      {/* Refetch error recovery */}
      {(refetchError || localRefetchError) && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800" data-testid={`review-form-conform-refetch-error${testIdSuffix}`}>
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
