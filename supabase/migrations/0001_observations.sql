-- One row per (capture, asset, layer, venue). Scores are computed on read.
create table if not exists observations (
  captured_at timestamptz not null,
  crypto_id   int         not null,
  symbol      text        not null,
  layer       text        not null check (layer in ('spot','forward','onchain','rwa')),
  venue_id    text        not null,
  venue_name  text,
  price       numeric,
  volume_24h  numeric,
  extra       jsonb,      -- funding, OI, index_price, basis, exclusions, ...
  primary key (captured_at, crypto_id, layer, venue_id)
);
create index if not exists observations_asset_time on observations (crypto_id, captured_at desc);

-- Liquidations are per asset, not per venue: keep them in their own small table.
create table if not exists liquidations (
  captured_at timestamptz not null,
  crypto_id   int         not null,   -- 0 = market total
  symbol      text        not null,
  long_1h numeric, short_1h numeric, long_4h numeric, short_4h numeric, long_24h numeric, short_24h numeric,
  primary key (captured_at, crypto_id)
);

-- Only the server (service key) touches these; the browser never does.
alter table observations enable row level security;
alter table liquidations enable row level security;
