BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

WITH products(kind, units, gross_yen) AS (
  VALUES ('route', 24, 1480), ('topup', 15, 550)
), active_grants AS (
  SELECT
    grants.id,
    grants.kind,
    grants.units,
    grants.expires_at,
    GREATEST(grants.units - COALESCE(SUM(spends.units), 0), 0) AS unused_units
  FROM credit_grants AS grants
  LEFT JOIN credit_spends AS spends ON spends.grant_id = grants.id AND spends.state = 'spent'
  WHERE grants.kind IN ('route', 'topup')
    AND grants.starts_at <= CURRENT_TIMESTAMP
    AND grants.revoked_at IS NULL
    AND (grants.expires_at IS NULL OR grants.expires_at > CURRENT_TIMESTAMP)
  GROUP BY grants.id
), balances AS (
  SELECT
    products.kind,
    COUNT(grants.id) AS active_grants,
    COALESCE(SUM(grants.unused_units), 0) AS unused_units,
    -- 人物パックは購入権込みの全額を枠に割り当て、未使用額を切り上げる。
    COALESCE(SUM(CEIL(grants.unused_units::numeric * products.gross_yen / products.units)), 0)
      AS estimated_unused_yen,
    COUNT(grants.id) FILTER (
      WHERE grants.units <> products.units OR grants.expires_at IS NOT NULL
    ) AS grants_to_check
  FROM products
  LEFT JOIN active_grants AS grants USING (kind)
  GROUP BY products.kind
)
SELECT
  CURRENT_TIMESTAMP AS checked_at,
  COALESCE(kind, 'total') AS kind,
  SUM(active_grants) AS active_grants,
  SUM(unused_units) AS unused_units,
  SUM(estimated_unused_yen) AS estimated_unused_yen,
  SUM(grants_to_check) AS grants_to_check
FROM balances
GROUP BY GROUPING SETS ((kind), ())
ORDER BY kind;

COMMIT;
