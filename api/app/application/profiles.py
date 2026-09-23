from app.application.ports import ProfileRepository
from app.domain.career import CareerGoal

class ProfileService:
    """Application use case. Persistence and HTTP details stay behind adapters."""
    def __init__(self, profiles: ProfileRepository):
        self.profiles = profiles

    def get_profile(self, employee_id: str) -> dict:
        result = self.profiles.get_profile(employee_id)
        goal = CareerGoal.from_data(result["employee"]["career_goal"])
        result["employee"]["goal_label"] = goal.label() if goal else None
        return result
