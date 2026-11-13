# Documentation guide

## Current entry points

- [README.md](./README.md): live demo links, local startup, seed-mode context, and a short walkthrough.
- [CONTRIBUTING.md](./CONTRIBUTING.md): setup, validation, browser journeys, and contribution expectations.
- [Route contract](./spec/support/route_contract.rb): canonical public GET routes and feature-gated exceptions.
- [Documentation route guard](./spec/routing/documented_routes_spec.rb): checks README and contributor-guide routes, local links, and executable references.
- [Control Plane deployment](./.controlplane/README.md): environments, deployments, and review apps.

## Performance evidence and reproduction

Measurements are tied to their documented build, device, dataset, network, and cache conditions. They are not guarantees for the current live deployment.

- [PERFORMANCE_EVIDENCE.md](./PERFORMANCE_EVIDENCE.md): dated live measurements and claim-by-claim limitations.
- [BENCHMARKING.md](./BENCHMARKING.md): Web Vitals measurement and ShakaPerf comparison commands.
- [Cached page variants](./docs/cached-page-variants-benchmark.md).
- [Pull-mode async props](./docs/pull-mode-async-props-benchmark.md).
- [Server caching](./docs/unstable-cache-benchmark.md).
- [Virtualized restaurant reviews](./docs/react-virtuoso-rsc-benchmark.md).
- [React Compiler](./docs/react-compiler-benchmark.md).

## Architecture and integration experiments

- [Rspack migration](./RSPACK_MIGRATION.md).
- [CSS code splitting](./docs/css-code-splitting-experiment.md).
- [RSC build implementations](./docs/rsc-build-implementations.md).
- [Apollo Client and RSC](./docs/apollo-client-rsc.md).
- [Form-library comparison](./docs/form-library-recommendation.md).
- [Read-your-writes and RSC refresh](./docs/rsc-read-your-writes.md).

Experiments may require feature flags or have documented limitations; consult the corresponding report before using them as a demo or benchmark.

## Historical planning archive

These documents preserve the original proposal. Their task status, file layouts, routes, seed volumes, latency targets, and commands are historical, not current setup or acceptance criteria. Use the README, contributor guide, code, and dated measurements above for the current app.

- [Original five-task implementation plan](./IMPLEMENTATION_TASKS.md).
- [Task 1: Setup and database](./tasks/Task_1_Setup_and_Database.md).
- [Task 2: Shared components and API](./tasks/Task_2_Shared_Components_and_API.md).
- [Task 3: Traditional version](./tasks/Task_3_Traditional_Version.md).
- [Task 4: RSC version](./tasks/Task_4_RSC_Version.md).
- [Task 5: Dashboard and docs](./tasks/Task_5_Dashboard_and_Docs.md).
