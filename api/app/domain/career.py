from dataclasses import dataclass

@dataclass(frozen=True)
class CareerGoal:
    target_role: str
    target_grade: str

    @classmethod
    def from_data(cls, value: dict | None) -> "CareerGoal | None":
        if value is None:
            return None
        return cls(target_role=value["target_role"], target_grade=value["target_grade"])

    def label(self) -> str:
        return f"{self.target_role} · {self.target_grade}"
