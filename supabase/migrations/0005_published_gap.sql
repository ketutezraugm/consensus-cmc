-- How far our recorded venue composite sits from CMC's own single published price, per capture.
-- The published price is never fed into the composite; this is a check against it, not an input.
alter table asset_scores add column if not exists published_price numeric;
alter table asset_scores add column if not exists published_gap_bps numeric;
