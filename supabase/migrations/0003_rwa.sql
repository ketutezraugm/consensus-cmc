-- One row per (capture, tokenised asset): how far apart the issuers' tokens for one underlying are.
create table if not exists rwa_scores (
  captured_at    timestamptz not null,
  rwa_id         int         not null,
  symbol         text        not null,
  asset_type     text,
  tokens         int,
  liquid         int,
  issuers        int,
  ref_price      numeric,
  spread_bps     numeric,
  dispersion_bps numeric,
  untracked      int,
  thin_off       int,
  unit_mismatch  int,
  top_issuer     text,
  top_share      numeric,
  mcap           numeric,
  primary key (captured_at, rwa_id)
);
create index if not exists rwa_scores_symbol_time on rwa_scores (symbol, captured_at desc);
alter table rwa_scores enable row level security;
