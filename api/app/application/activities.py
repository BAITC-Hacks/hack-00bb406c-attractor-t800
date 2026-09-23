from typing import Protocol
from app.domain.activities import ActivityConflict, available_sessions, forecast, validate_audience
from app.domain.trajectory import REPEATABLE_EVENTS, day


class ActivityRepository(Protocol):
    def profile(self, employee_id: str) -> dict: ...
    def events(self) -> list[dict]: ...
    def event(self, event_id: str) -> dict: ...
    def lock_employee(self, employee_id: str): ...
    def participation(self, employee_id: str, record_id: str) -> dict: ...
    def enroll(self, employee_id: str, event_id: str, session_date) -> dict: ...
    def transition(self, record_id: str, status: str, as_of_date) -> dict: ...


class ActivityService:
    def __init__(self, repository: ActivityRepository):
        self.repository = repository

    def card(self, event, profile):
        validate_audience(event, profile)
        active = next((h for h in profile['history'] if h['event_id'] == event['event_id'] and h['status'] in ('planned', 'in_progress')), None)
        sessions = available_sessions(event, profile)
        if not sessions and not active:
            raise ActivityConflict('Нет доступной сессии или активность уже завершена')
        return {**event, 'available_sessions': sessions, 'participation': active, 'current': profile['trajectory'], 'forecast': forecast(event, profile['trajectory']), 'dataset_version': profile['dataset_version']}

    def list(self, employee_id):
        profile = self.repository.profile(employee_id)
        result = []
        for event in self.repository.events():
            try:
                result.append(self.card(event, profile))
            except ActivityConflict:
                continue
        return result

    def preview(self, employee_id, event_id):
        return self.card(self.repository.event(event_id), self.repository.profile(employee_id))

    def enroll(self, employee_id, event_id, session_date):
        self.repository.lock_employee(employee_id)
        profile = self.repository.profile(employee_id)
        card = self.card(self.repository.event(event_id), profile)
        if card['participation']:
            raise ActivityConflict('Участие уже существует — продолжите его')
        selected = str(session_date or profile['as_of_date'])
        if selected not in card['available_sessions']:
            raise ActivityConflict('Выбранная сессия недоступна')
        return self.repository.enroll(employee_id, event_id, day(selected))

    def transition(self, employee_id, record_id, action):
        self.repository.lock_employee(employee_id)
        record = self.repository.participation(employee_id, record_id)
        # Repeated delivery of this exact completion is a read, never another gain.
        if action == 'complete' and record['status'] == 'completed':
            return record
        profile = self.repository.profile(employee_id)
        event = self.repository.event(record['event_id'])
        validate_audience(event, profile)
        other_completed = [h for h in profile['history'] if h['event_id'] == event['event_id'] and h['status'] == 'completed']
        if any(event['event_id'] not in REPEATABLE_EVENTS or day(h['date']) == day(record['date']) for h in other_completed):
            raise ActivityConflict('Активность или сессия уже завершена')
        if day(record['date']) > day(profile['as_of_date']):
            raise ActivityConflict('Сессия ещё не наступила')
        if event['format'] != 'self_paced' and str(record['date']) not in event['upcoming_sessions']:
            raise ActivityConflict('Сессия больше не доступна в каталоге')
        expected, target = ('planned', 'in_progress') if action == 'start' else ('in_progress', 'completed')
        if record['status'] != expected:
            raise ActivityConflict('Недопустимый переход состояния участия')
        return self.repository.transition(record_id, target, profile['as_of_date'])
