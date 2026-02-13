from app.repositories import brokers_config


class BrokersConfigService:
    @staticmethod
    def get_supervisors_scope(db):
        return brokers_config.get_supervisor_scope(db)

    @staticmethod
    def save_supervisors_scope(db, supervisors: list[str], actor: str):
        normalized = sorted(list({str(s).strip().upper() for s in supervisors if str(s).strip()}))
        return brokers_config.save_supervisor_scope(db, normalized, actor)

    @staticmethod
    def get_commissions(db):
        return brokers_config.get_commission_rules(db)

    @staticmethod
    def save_commissions(db, rules: list[dict], actor: str):
        return brokers_config.save_commission_rules(db, rules, actor)

    @staticmethod
    def get_prizes(db):
        return brokers_config.get_prize_rules(db)

    @staticmethod
    def save_prizes(db, rules: list[dict], actor: str):
        return brokers_config.save_prize_rules(db, rules, actor)
