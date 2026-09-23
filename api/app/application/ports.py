from typing import Protocol

class ProfileRepository(Protocol):
    def get_profile(self, employee_id: str) -> dict: ...
