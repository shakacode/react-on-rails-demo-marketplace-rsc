# Form Libraries on RSC Pages — Recommendation

> Which form approach should a React on Rails Pro app reach for on an RSC page?
> Measured and tested with running code on the demo marketplace.

---

## The recommendation

### For simple forms (1–5 fields, server validation is enough):

**Use React 19 built-ins.** Zero dependencies. `useActionState` + `useFormStatus` +
`useOptimistic` handle pending states, error display, and optimistic updates.
You write ~360 lines and ship **+5.0 kB** to the browser. Know about the
form-reset gotcha (React #29034) — you'll need the `formKey` remount trick,
which costs ~10 extra lines and loses focus on error.

### For forms where the server is the authority (Rails model validations):

**Use Conform (`@conform-to/react`).** It's the only library that works with
React 19's `<form action>` — so `useFormStatus` works in a child button,
and Conform's `lastResult` + `submission.reply()` handles the form-reset
gotcha without remounting (preserves focus). The Rails 422 error shape maps
in one line: `submission.reply({ fieldErrors: body.errors })`. Import from
`@conform-to/zod/v4` for zod v4 compatibility.

**Cost:** +39.2 kB gzip (includes zod). Best architectural fit for Rails.

### For complex client-side forms (multi-step, conditional fields, lots of client rules):

**Use react-hook-form + zod.** It has the largest ecosystem (~40-58M
downloads/week), the most examples, and controlled inputs that completely
bypass the form-reset gotcha. Accept that it uses `onSubmit` instead of
`action` — you lose `useFormStatus` but gain RHF's own `isSubmitting` flag.
Use `z.coerce.number()` for `<select>` fields.

**Cost:** +39.8 kB gzip (includes zod). Most battle-tested.

### For TypeScript-heavy codebases:

**Consider TanStack Form.** Best type inference, but the most verbose
per-field (render-prop pattern), `setFieldMeta` has known bugs (#1260, #1386)
for server error mapping, and it shipped the largest bundle in our measurement.

**Cost:** +44.3 kB gzip (includes zod). Newest, roughest edges.

---

## Measured bundle sizes

Production rspack build, gzipped, per-variant async client chunk:

| Variant | Client chunk (gzip) | Delta vs baseline | Includes |
|---------|-------------------|-------------------|----------|
| **React 19 built-ins** | 5.0 kB | — | Component only |
| **Conform** | 39.2 kB | +34.2 kB | @conform-to/react + @conform-to/zod + zod |
| **RHF + zod** | 39.8 kB | +34.8 kB | react-hook-form + @hookform/resolvers + zod |
| **TanStack Form** | 44.3 kB | +39.3 kB | @tanstack/react-form + zod |
| *Spike button (reference)* | *4.0 kB* | *-1.0 kB* | *No form, just a button* |

### Does the zod schema ship to the browser?

**Yes.** Zod schemas are runtime JavaScript objects — `z.string().min(1)` is
code that must be in the bundle for client-side validation. Every library
variant that uses zod includes the full zod runtime in its chunk. The chunks
are not deduplicated across variants (each island gets its own copy).

### Can `zod/mini` shrink it?

In theory, `zod/mini` (~2-4 kB) replaces the full zod runtime (~15-20 kB).
In practice, both `@conform-to/zod/v4` and `@hookform/resolvers` import from
`zod` (not `zod/mini`), so the full runtime is pulled in regardless. You'd
need to skip the schema adapters and use `safeParse` directly — which is what
TanStack Form already does. The bundle savings would be modest (~10-15 kB)
because the form library itself is the larger portion.

**Conclusion:** For this form size (4 fields), the zod overhead is acceptable.
For a form-heavy app with many pages, extract a shared zod chunk via
rspack's `splitChunks` configuration.

---

## Compatibility matrix

| Feature | React 19 Built-ins | Conform | RHF + zod | TanStack Form |
|---------|-------------------|---------|-----------|---------------|
| **Architecture** |
| Submission model | `<form action>` | `<form action>` | `<form onSubmit>` | `<form onSubmit>` |
| `useFormStatus` works? | ✅ | ✅ | ❌ (own `isSubmitting`) | ❌ (own `isSubmitting`) |
| `useActionState` works? | ✅ | ✅ | ❌ | ❌ |
| Input model | Uncontrolled | Uncontrolled (FormData) | Controlled (`register`) | Controlled (`form.Field`) |
| **Form-reset gotcha (React #29034)** |
| Affected? | Yes | Yes (but handled) | No | No |
| Fix mechanism | `formKey` remount | `lastResult` + `reply()` | N/A (controlled) | N/A (controlled) |
| Focus preserved on error? | ❌ (remount) | ✅ | ✅ | ✅ |
| **Rails integration** |
| 422 error mapping | 3 lines (manual) | 1 line (`reply({ fieldErrors })`) | 5 lines (`setError` loop) | 5 lines (`useState`) |
| CSRF token | Manual header | Manual header | Manual header | Manual header |
| `snake_case` field names | Works as-is | Works as-is | Works as-is | Works as-is |
| `refetch()` after success | ✅ | ✅ | ✅ | ✅ |
| **Validation** |
| Client-side | None | zod via `@conform-to/zod/v4` | zod via `zodResolver` | zod via `safeParse` |
| zod v4 compatible? | N/A | ✅ (import from `/v4`) | ✅ (`z.coerce` needed for select) | ✅ |
| Schema ships to browser? | No | Yes | Yes | Yes |
| **Bundle** |
| Client chunk (gzip) | 5.0 kB | 39.2 kB | 39.8 kB | 44.3 kB |
| Extra npm packages | 0 | 2 | 3 | 1 |
| **Accessibility** |
| `aria-describedby` | Manual | Built-in (`getInputProps`) | Manual | Manual |
| Focus on error | Manual | Built-in | Built-in (`shouldFocusError`) | Manual |
| **DX** |
| Lines of code (our form) | 361 | 306 | 260 | 296 |
| TypeScript inference | Basic | Good | Good | Excellent |
| QA fixes needed | 2 (formKey, optimistic gap) | 1 (zod/v4 subpath) | 1 (z.coerce.number) | 0 |
| Progressive enhancement | ❌ | ❌ | ❌ | ❌ |

---

## Key findings from the implementation

### 1. The form-reset gotcha is the deciding factor

React 19's `<form action>` resets all uncontrolled fields after every submit
(React #29034). This is the single biggest differentiator:
- **Conform** handles it best — `lastResult` preserves values without remounting
- **RHF/TanStack** avoid it entirely by using controlled inputs + `onSubmit`
- **React 19 built-ins** need the `formKey` remount trick (works but loses focus)

### 2. Conform is the only library in the `<form action>` world

Conform uses `<form action>`, so `useFormStatus` works in a child component.
RHF and TanStack use `onSubmit`, which means `useFormStatus` never fires —
they substitute their own `isSubmitting` flag. This matters if you want
consistent React 19 patterns across your app.

### 3. `@conform-to/zod` ships a `/v4` subpath

The default import targets zod v3. Import from `@conform-to/zod/v4` for
zod v4 compatibility. This isn't documented prominently — we discovered it
by reading the package's `exports` map in `package.json`.

### 4. RHF needs `z.coerce.number()` for `<select>` fields

HTML `<select>` returns string values. `z.number()` rejects them.
`z.coerce.number()` handles the string→number conversion. This is a
common gotcha with RHF + zod.

### 5. `useState` doesn't survive RSC refetch remounts

Components using `onSubmit` + `startTransition(refetch)` lose their
`useState` values when the RSC re-stream remounts the island. Status
text like "Review #42 posted!" disappears. `useActionState` (used by
the baseline and Conform) persists through its own transition because
the action awaits the refetch before returning.

### 6. All four libraries work on RSC pages

No RSC-specific failures. The `ForServer` wrapper pattern handles the
bundle boundary. `pnpm lint:rsc` passes for all variants. The form
libraries don't interfere with server component streaming.

### 7. TanStack Form was the most stable during QA

Zero fixes needed across 4 QA rounds. RHF needed 1 fix (coerce), Conform
needed 1 fix (zod/v4 subpath), the baseline needed 2 fixes (formKey, optimistic gap). TanStack's controlled-input + manual-safeParse approach
was the most predictable.

---

## When to use each

| Situation | Recommendation |
|-----------|---------------|
| Simple form, few fields, server validates everything | **React 19 built-ins** (0 kB) |
| Rails-first app, server-authoritative validation | **Conform** (39.2 kB) |
| Complex form, lots of client-side rules, need ecosystem support | **RHF + zod** (39.8 kB) |
| TypeScript-heavy, want best type inference | **TanStack Form** (44.3 kB) |
| Need `useFormStatus` to work | **React 19 built-ins** or **Conform** only |
| Need progressive enhancement (no-JS) | None — requires `'use server'` (Next.js/Remix) |
