-- Small per-capture summaries so the site can chart history without scanning raw observations.
create table if not exists asset_scores (
  captured_at     timestamptz not null,
  crypto_id       int         not null,
  symbol          text        not null,
  venues          int,
  confidence      int,
  effective_venues numeric,
  top_venue       text,
  top_share       numeric,
  agreeing_share  numeric,
  excluded_share  numeric,
  stale_share     numeric,
  dispersion_bps  numeric,
  dup_markets     int,
  dex_gap_bps     numeric,
  funding         numeric,
  basis           numeric,
  primary key (captured_at, crypto_id)
);
create index if not exists asset_scores_symbol_time on asset_scores (symbol, captured_at desc);

-- Venues CMC trusts for price that quote >1% away from the trusted median, one row per capture.
create table if not exists anomalies (
  captured_at timestamptz not null,
  symbol      text        not null,
  venue_id    text        not null,
  venue_name  text        not null,
  pair        text,
  bps         numeric,
  volume_24h  numeric,
  dup         boolean     not null default false,
  primary key (captured_at, symbol, venue_id)
);
create index if not exists anomalies_venue on anomalies (symbol, venue_name, captured_at desc);

alter table asset_scores enable row level security;
alter table anomalies enable row level security;
