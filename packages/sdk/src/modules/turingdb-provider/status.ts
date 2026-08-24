/**
 * TuringDB's query status codes, as returned in `QueryResponse.error`.
 *
 * **Source of truth:** [`db::QueryStatus::Status`](https://github.com/turing-db/turingdb/blob/2cd5d588e7e6d5e6ae17df39fc3d210c71646ff/base/QueryStatus.h)
 * in the engine itself — not documented on docs.turingdb.ai, so ⚠️ keep this in sync manually if
 * the upstream enum changes. `OK` is omitted: it never appears in `error`.
 */
export const TuringDBErrorCode = {
  GRAPH_NOT_FOUND: "GRAPH_NOT_FOUND",
  PARSE_ERROR: "PARSE_ERROR",
  ANALYZE_ERROR: "ANALYZE_ERROR",
  PLAN_ERROR: "PLAN_ERROR",
  EXEC_ERROR: "EXEC_ERROR",
  COMMIT_NOT_FOUND: "COMMIT_NOT_FOUND",
  COMMIT_NOT_LOADED: "COMMIT_NOT_LOADED",
  CHANGE_NOT_FOUND: "CHANGE_NOT_FOUND",
} as const;

export type TuringDBErrorCode =
  (typeof TuringDBErrorCode)[keyof typeof TuringDBErrorCode];
