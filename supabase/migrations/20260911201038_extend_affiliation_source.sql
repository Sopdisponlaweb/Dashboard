-- Adds the two remaining historical payer boxes (INPEC, ORDISPONAL) found in the
-- legacy database so migrated affiliates and payments keep their real classification
-- instead of being collapsed into "particular".
alter type public.affiliation_source add value if not exists 'inpec';
alter type public.affiliation_source add value if not exists 'ordisponal';
