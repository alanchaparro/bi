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

    @staticmethod
    def get_brokers_preferences(db, username: str):
        return brokers_config.get_user_preferences(db, username, 'brokers.filters')

    @staticmethod
    def save_brokers_preferences(db, username: str, value: dict):
        return brokers_config.save_user_preferences(db, username, 'brokers.filters', value)

    @staticmethod
    def get_cartera_preferences(db, username: str):
        return brokers_config.get_user_preferences(db, username, 'cartera_filters_v1')

    @staticmethod
    def save_cartera_preferences(db, username: str, value: dict):
        return brokers_config.save_user_preferences(db, username, 'cartera_filters_v1', value)

    @staticmethod
    def get_cartera_tramo_rules(db):
        return brokers_config.get_cartera_tramo_rules(db)

    @staticmethod
    def save_cartera_tramo_rules(db, value: dict, actor: str):
        return brokers_config.save_cartera_tramo_rules(db, value, actor)

    @staticmethod
    def get_cartera_uns(db):
        return brokers_config.get_cartera_uns(db)
