-- Seed minimal QA data
INSERT INTO brokers_supervisor_scope (id, supervisors_json, updated_at)
VALUES (1, '["FVBROKEREAS","FVBROKEREASCDE"]', CURRENT_TIMESTAMP);

INSERT INTO commission_rules (id, rules_json, updated_at)
VALUES (1, '[]', CURRENT_TIMESTAMP);

INSERT INTO prize_rules (id, rules_json, updated_at)
VALUES (1, '[]', CURRENT_TIMESTAMP);
