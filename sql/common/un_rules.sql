CASE
    WHEN c.request_financing_number IS NOT NULL THEN 'ODONTOLOGIA TTO'
    ELSE e.name
END
