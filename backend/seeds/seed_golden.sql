-- Seed baseline for golden QA scenarios
INSERT INTO brokers_supervisor_scope (id, supervisors_json, updated_at)
VALUES (1, '["FVBROKEREAS","FVBROKEREASCDE"]', CURRENT_TIMESTAMP);

INSERT INTO commission_rules (id, rules_json, updated_at)
VALUES (
  1,
  '[{"supervisors":["FVBROKEREAS","FVBROKEREASCDE"],"uns":["ODONTOLOGIA"],"vias":["COBRADOR"],"months":["01/2026"],"factor":2.4}]',
  CURRENT_TIMESTAMP
);

INSERT INTO prize_rules (id, rules_json, updated_at)
VALUES (
  1,
  '[{"supervisors":["FVBROKEREAS","FVBROKEREASCDE"],"uns":["ODONTOLOGIA","MEDICINA ESTETICA"],"months":["01/2026"],"meta":130,"scales":[{"minPct":70,"prize":2800000},{"minPct":120,"prize":5000000}]}]',
  CURRENT_TIMESTAMP
);
