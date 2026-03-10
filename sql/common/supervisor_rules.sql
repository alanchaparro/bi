CASE
    WHEN UPPER(REPLACE(REPLACE(TRIM(CONCAT_WS(' ', sup.first_name, sup.last_name)), '.', ''), '  ', ' ')) = 'FVBROKEREAS'
     AND UPPER(REPLACE(REPLACE(TRIM(CONCAT_WS(' ', seller.first_name, seller.last_name)), '.', ''), '  ', ' ')) = 'FVBROKEREASCDE'
    THEN CONCAT_WS(' ', seller.first_name, seller.last_name)
    ELSE CONCAT_WS(' ', sup.first_name, sup.last_name)
END
