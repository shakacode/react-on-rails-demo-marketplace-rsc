'use client';

// Read-your-writes spike (issue #245).
//
// A single button — deliberately NOT a form (form libraries are issue #244) —
// that (1) POSTs a canned review to the plain Rails write endpoint, then
// (2) asks the enclosing <RSCRoute> to refetch the streamed server-component
// page, so the fresh review should appear with no navigation.
//
// The canned payload varies reviewer_name/title with a timestamp so every
// click is distinguishable in the rendered list, and pins helpful_count above
// the seeded maximum (120) so the new review enters the top_reviews(5) window
// the page streams from (see ProductReviewsController#review_params).

import React, { useRef, useState, useTransition } from 'react';
import { useCurrentRSCRoute } from 'react-on-rails-pro/RSCRoute';

interface Props {
  productId: number;
  // C5 (issue #245): 'page' (default) — the island sits directly under the
  // page-level <RSCRoute> that registerServerComponent wraps around
  // ProductPageRSC, so refetch() re-renders the WHOLE page tree. 'section' —
  // the island is rendered inside the nested ProductReviewsSectionRSC route,
  // so useCurrentRSCRoute() resolves to that nearer handle and refetch() is
  // scoped to the reviews section only. Test ids gain a '-section' suffix so
  // both instances stay addressable on one page.
  scope?: 'page' | 'section';
}

type PostState =
  | { phase: 'idle' }
  | { phase: 'posting' }
  | { phase: 'posted'; reviewerName: string; reviewId: number }
  | { phase: 'error'; message: string };

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}

export function ReviewMutationIsland({ productId, scope = 'page' }: Props) {
  const testIdSuffix = scope === 'section' ? '-section' : '';
  const { refetch, retry, refetchError, clearRefetchError } = useCurrentRSCRoute();
  const [isRefetching, startTransition] = useTransition();
  const [postState, setPostState] = useState<PostState>({ phase: 'idle' });
  const [localRefetchError, setLocalRefetchError] = useState<string | null>(null);
  // Synchronous double-submit guard: `busy` is render-state and can lag one
  // frame between the POST settling and the transition's isPending flipping,
  // so a fast double-click could fire a second POST. The ref closes that gap.
  const postInFlightRef = useRef(false);

  const runRefetch = (doFetch: () => Promise<unknown>) => {
    setLocalRefetchError(null);
    startTransition(async () => {
      try {
        await doFetch();
      } catch (e) {
        // Outside production RSCRoute lets refetch failures throw loudly; keep
        // a copy here so the failure text stays visible for the spike evidence.
        setLocalRefetchError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      } finally {
        postInFlightRef.current = false; // release the double-submit guard once the refetch settles
      }
    });
  };

  const handleClick = async () => {
    if (postInFlightRef.current) return;
    postInFlightRef.current = true;

    setPostState({ phase: 'posting' });
    const stamp = new Date().toISOString().slice(11, 19);
    const reviewerName = scope === 'section' ? `Spike Bot Sec ${stamp}` : `Spike Bot ${stamp}`;

    try {
      // Step 1 — save it: a plain Rails endpoint does the write.
      const response = await fetch(`/products/${productId}/reviews`, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({
          review: {
            rating: 5,
            title: `Read-your-writes probe @ ${stamp}`,
            comment: 'Canned review posted by the #245 spike button, followed by an RSCRoute refetch.',
            reviewer_name: reviewerName,
            verified_purchase: true,
            helpful_count: 500,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        postInFlightRef.current = false;
        setPostState({ phase: 'error', message: `POST failed with ${response.status}: ${body.slice(0, 200)}` });
        return;
      }

      // A 2xx does not guarantee a JSON body of the expected shape; surface a
      // precise error instead of letting SyntaxError fall into the generic catch.
      let reviewId: number;
      try {
        const body = (await response.json()) as { id?: unknown };
        if (typeof body.id !== 'number') throw new Error('response body lacked a numeric id');
        reviewId = body.id;
      } catch (e) {
        postInFlightRef.current = false;
        setPostState({
          phase: 'error',
          message: `POST succeeded but the response was unusable — ${e instanceof Error ? e.message : String(e)}`,
        });
        return;
      }
      setPostState({ phase: 'posted', reviewerName, reviewId });

      // Step 2 — see it: ask the enclosing RSCRoute to re-render the page's
      // server component tree from fresh Rails data.
      // The transition's finally releases the guard once the refetch settles,
      // so the ref stays held across the posting→isPending flag-flip gap.
      runRefetch(refetch);
    } catch (e) {
      postInFlightRef.current = false;
      setPostState({ phase: 'error', message: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
    }
  };

  const busy = postState.phase === 'posting' || isRefetching;

  const refetchingLabel = scope === 'section' ? 'Refreshing section…' : 'Refreshing page…';
  const idleLabel = scope === 'section' ? 'Post a canned review (section refetch)' : 'Post a canned review';

  return (
    <div
      data-testid={`review-mutation-island${testIdSuffix}`}
      className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid={`post-canned-review${testIdSuffix}`}
          onClick={handleClick}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {postState.phase === 'posting' ? 'Posting review…' : isRefetching ? refetchingLabel : idleLabel}
        </button>
        <span className="text-indigo-900" data-testid={`mutation-status${testIdSuffix}`} aria-live="polite">
          {postState.phase === 'posted' &&
            !isRefetching &&
            !refetchError &&
            !localRefetchError &&
            `Posted review #${postState.reviewId} as “${postState.reviewerName}” and refetched.`}
          {postState.phase === 'posted' &&
            !isRefetching &&
            (refetchError || localRefetchError) &&
            `Posted review #${postState.reviewId} as “${postState.reviewerName}”; the refetch failed — see below.`}
          {postState.phase === 'posted' && isRefetching && `Posted as “${postState.reviewerName}”; refetching…`}
          {postState.phase === 'error' && `Write failed — ${postState.message}`}
          {postState.phase === 'idle' && 'Spike #245: POST a canned review, then RSCRoute.refetch() this page.'}
        </span>
      </div>
      {(refetchError || localRefetchError) && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800" data-testid={`refetch-error${testIdSuffix}`}>
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
