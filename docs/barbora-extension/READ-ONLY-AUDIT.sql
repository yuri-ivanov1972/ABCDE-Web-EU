-- Executed 2026-11-02 through the configured external Maxima runtime connection.
-- Reference queries for an authorized read-only connection to the actual external
-- Maxima database, not the Replit-managed database or the separate Rimi DB.
-- Aggregate/catalog queries only. No DDL, writes, credentials or PII.
-- Run with a bounded statement timeout configured by the connection.

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('products', 'nutritionfacts')
  AND column_name IN ('product_id', 'sku', 'barbora_url',
                     'nutri_score_grade', 'updated_at', 'data_source_date')
ORDER BY table_name, ordinal_position;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('products', 'nutritionfacts')
ORDER BY tablename, indexname;

SELECT COUNT(*) AS total_products,
       COUNT(*) FILTER (WHERE sku IS NULL OR btrim(sku) = '') AS blank_skus,
       COUNT(*) FILTER (WHERE sku !~ '^[0-9]{18}$') AS non_18_digit_skus,
       COUNT(*) FILTER (WHERE barbora_url IS NULL OR btrim(barbora_url) = '') AS missing_urls,
       COUNT(*) FILTER (WHERE updated_at IS NULL) AS missing_product_update_dates,
       MIN(updated_at) AS oldest_product_update,
       MAX(updated_at) AS newest_product_update
FROM products;

SELECT CASE
         WHEN nf.product_id IS NULL THEN 'no_nutrition_row'
         WHEN nf.nutri_score_grade IS NULL THEN 'null_grade'
         WHEN nf.nutri_score_grade::text = '' THEN 'blank_grade'
         WHEN nf.nutri_score_grade IN ('A','B','C','D','E') THEN nf.nutri_score_grade::text
         ELSE 'other_grade'
       END AS grade_bucket, COUNT(*) AS rows
FROM products p
LEFT JOIN nutritionfacts nf ON nf.product_id = p.product_id
GROUP BY 1 ORDER BY 1;

-- Grade counts above are join-row counts; run the multiplicity checks before
-- interpreting them as product coverage.
SELECT COUNT(*) AS duplicate_sku_groups
FROM (SELECT sku FROM products GROUP BY sku HAVING COUNT(*) > 1) d;

SELECT COUNT(*) AS duplicate_nutrition_product_groups
FROM (SELECT product_id FROM nutritionfacts
      GROUP BY product_id HAVING COUNT(*) > 1) d;

SELECT COUNT(*) AS duplicate_exact_url_groups
FROM (SELECT barbora_url FROM products
      WHERE barbora_url IS NOT NULL AND btrim(barbora_url) <> ''
      GROUP BY barbora_url HAVING COUNT(*) > 1) d;

SELECT COUNT(*) AS conflicting_grade_sku_groups
FROM (
  SELECT p.sku
  FROM products p
  JOIN nutritionfacts nf ON nf.product_id = p.product_id
  GROUP BY p.sku
  HAVING COUNT(DISTINCT COALESCE(nf.nutri_score_grade::text, '<NULL>')) > 1
) d;

SELECT COUNT(*) AS nutrition_rows,
       COUNT(*) FILTER (WHERE data_source_date IS NULL) AS unknown_source_date,
       COUNT(*) FILTER (WHERE data_source_date < CURRENT_TIMESTAMP - INTERVAL '90 days') AS source_over_90_days,
       MIN(data_source_date) AS oldest_source_date,
       MAX(data_source_date) AS newest_source_date
FROM nutritionfacts;

-- Age is a review signal, not proof a product/grade is stale or current.
-- No SQL or URL normalization is authority to merge retailer products.
