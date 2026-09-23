from app.application.ports import ProfileRepository
from app.domain.career import CareerGoal
from app.domain.trajectory import build_trajectory

class ProfileService:
    """Application use case. Persistence and HTTP details stay behind adapters."""
    def __init__(self, profiles: ProfileRepository):
        self.profiles = profiles

    def get_profile(self, employee_id: str) -> dict:
        result = self.profiles.get_profile(employee_id)
        goal = CareerGoal.from_data(result["employee"]["career_goal"])
        result["employee"]["goal_label"] = goal.label() if goal else None
        result["trajectory"] = build_trajectory(result["employee"], result.pop("assessed_skills"), result.pop("role_profiles"), result["history"], result.pop("skill_names"), result["as_of_date"])
        return result
