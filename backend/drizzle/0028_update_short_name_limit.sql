UPDATE "app_users"
SET "short_name" = UPPER(SUBSTRING("display_name", 1, 8))
WHERE STARTS_WITH(UPPER("display_name"), "short_name")
  AND LENGTH("display_name") > LENGTH("short_name");
