"""Verified catalog facts are the only source of recommendation explanations."""
import asyncio
from collections import Counter
from datetime import timedelta
import logging
from time import monotonic
from typing import Protocol

from app.application.activities import ActivityService
from app.domain.activities import ActivityConflict
from app.domain.trajectory import REPEATABLE_EVENTS, day

RULES_VERSION = '1.0'
MODEL_BUDGET_SECONDS = 8
REASONS = {
    'reduces_gap': 'Сокращает существующий разрыв к ориентиру.',
    'critical_gap': 'Сокращает критический разрыв к ориентиру.',
    'multiple_gaps': 'Одновременно сокращает несколько разрывов.',
    'continue': 'Можно продолжить существующее участие без повторной записи.',
    'history_alternative': 'Подходящая альтернатива активности с повторными пропусками или отказами.',
}
logger = logging.getLogger(__name__)


class RecommendationModel(Protocol):
    model: str
    async def select(self, context: dict) -> dict: ...


class ModelUnavailable(Exception):
    def __init__(self, reason):
        self.reason = reason


def build_candidates(repository, employee_id):
    profile = repository.profile(employee_id)
    candidates, excluded = candidates_for_profile(profile, repository.events())
    return profile, candidates, excluded


def candidates_for_profile(profile, catalog):
    if not profile['trajectory']['target']['profile_available']:
        return [], {'Нет профиля требований для выбранного ориентира': 1}
    if not any(s['gap'] for s in profile['trajectory']['skills']):
        return [], {'Все требования ориентира выполнены; можно выбрать или обсудить другую цель': 1}
    candidates, excluded = [], Counter()
    today = day(profile['as_of_date'])
    for event in catalog:
        if event['event_id'] not in REPEATABLE_EVENTS and any(h['event_id'] == event['event_id'] and h['status'] == 'completed' for h in profile['history']):
            excluded['Активность уже завершена'] += 1
            continue
        try:
            card = ActivityService.card(event, profile, catalog)
            active = card['participation']
            if active and any(h['event_id'] == event['event_id'] and h['status'] == 'completed' and day(h['date']) == day(active['date']) for h in profile['history']):
                excluded['Сессия существующего участия уже завершена'] += 1
                continue
            # An old active participation can still be completed, but is not a
            # new recommendation when its scheduled session has already passed.
            if event['format'] != 'self_paced' and card['participation'] and day(card['participation']['date']) < today:
                excluded['Сессия существующего участия уже прошла'] += 1
                continue
        except ActivityConflict as exc:
            reason = str(exc)
            if reason == 'Нет доступной сессии или активность уже завершена':
                completed = any(h['event_id'] == event['event_id'] and h['status'] == 'completed' for h in profile['history'])
                reason = 'Активность уже завершена' if completed and event['event_id'] not in REPEATABLE_EVENTS else 'Нет будущей незавершённой сессии'
            excluded[reason] += 1
            continue
        projected = {s['skill_id']: s for s in card['forecast']['skills']}
        effects = [dict(skill_id=s['skill_id'], name=s['name'], before=s['calculated_level'],
                        after=projected[s['skill_id']]['calculated_level'], required=s['required_level'],
                        gap_before=s['gap'], gap_after=projected[s['skill_id']]['gap'], critical=s['critical'])
                   for s in profile['trajectory']['skills'] if s['gap'] > projected[s['skill_id']]['gap']]
        if not effects:
            excluded['Доступная активность не сокращает текущие разрывы'] += 1
            continue
        history = [h for h in profile['history'] if h['event_id'] == event['event_id'] and day(h['date']) <= today]
        counts = dict(Counter(h['status'] for h in history))
        missed = sum(h['status'] in ('no_show', 'dropped', 'declined') and day(h['date']) >= today - timedelta(days=180) for h in history)
        score = sum((5 if e['critical'] else 2) * (e['gap_before'] - e['gap_after']) for e in effects) - 3 * min(2, missed)
        nearest = str(card['participation']['date']) if card['participation'] else min(card['available_sessions'])
        codes = ['reduces_gap']
        if any(e['critical'] for e in effects):
            codes.append('critical_gap')
        if len(effects) > 1:
            codes.append('multiple_gaps')
        if card['participation']:
            codes.append('continue')
        candidates.append(dict(event_id=event['event_id'], title=event['title'], format=event['format'],
                               duration_hours=event['duration_hours'], nearest_date=nearest, effects=effects,
                               history=counts, history_dates=[{'status': h['status'], 'date': str(h['date'])} for h in history],
                               recent_missed=missed, score=score, allowed_reasons=codes,
                               gain_rules=event['develops_skills'], activity_url=f"/api/me/activities/{event['event_id']}"))
    if not catalog:
        excluded['Каталог активностей пуст'] = 1
    for candidate in candidates:
        alternatives = [{'event_id': c['event_id'], 'recent_missed': c['recent_missed']} for c in candidates if c['recent_missed'] >= 2 and c['event_id'] != candidate['event_id']]
        candidate['history_alternatives'] = alternatives if candidate['recent_missed'] == 0 else []
        if candidate['history_alternatives']:
            candidate['allowed_reasons'].append('history_alternative')
    return candidates, dict(excluded)


def model_context(profile, candidates):
    # Allowlist: never send names, employee IDs, managers, work evidence or raw records.
    keys = ('event_id', 'format', 'duration_hours', 'nearest_date', 'history', 'history_dates',
            'recent_missed', 'score', 'allowed_reasons', 'history_alternatives', 'gain_rules')
    return {'current': {k: profile['employee'][k] for k in ('role', 'grade')},
            'requirements': [{k: s[k] for k in ('skill_id', 'calculated_level', 'required_level', 'critical', 'gap')} for s in profile['trajectory']['skills'] if s['required_level'] is not None],
            'target': profile['trajectory']['target'], 'as_of_date': str(profile['as_of_date']),
            'candidates': [{**{k: c[k] for k in keys}, 'effects': [{k: v for k, v in e.items() if k != 'name'} for e in c['effects']]} for c in candidates]}


def validate_selection(answer, candidates):
    if not isinstance(answer, dict) or set(answer) != {'recommendations'}:
        raise ValueError('Invalid response')
    rows = answer['recommendations']
    if not isinstance(rows, list) or not 1 <= len(rows) <= 3:
        raise ValueError('Invalid count')
    by_id, seen = {c['event_id']: c for c in candidates}, set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {'event_id', 'reasons'}:
            raise ValueError('Invalid selection')
        event_id, reasons = row['event_id'], row['reasons']
        if not isinstance(event_id, str) or event_id not in by_id or event_id in seen:
            raise ValueError('Unknown or duplicate event')
        if not isinstance(reasons, list) or not reasons or any(not isinstance(r, str) or r not in by_id[event_id]['allowed_reasons'] for r in reasons):
            raise ValueError('Unsupported reason')
        seen.add(event_id)
    return rows


def explain(candidate, profile, reasons):
    target = profile['trajectory']['target']
    kind = {'goal': 'Карьерная цель', 'provisional': 'Предварительный ориентир', 'current': 'Требования текущей роли'}[target['kind']]
    history = ', '.join(f'{status}: {count}' for status, count in sorted(candidate['history'].items())) or 'ещё не участвовал'
    facts = [f"Текущие роль и грейд: {profile['employee']['role']} / {profile['employee']['grade']}. Аудитория и предпосылки проверены; доступно с {candidate['nearest_date']}.",
             f"{kind}: {target['role']} / {target['grade']}. Соответствие требованиям не гарантирует повышения.",
             f"История этой активности: {history}. Пропуски/отказы за 180 дней: {candidate['recent_missed']}."]
    for effect in candidate['effects']:
        facts.append(f"{effect['name']}: сейчас {effect['before']}, требуется {effect['required']}; если завершить — {effect['after']}, разрыв {effect['gap_before']} → {effect['gap_after']}." + (' Критическое требование.' if effect['critical'] else ''))
    for alternative in candidate['history_alternatives']:
        facts.append(f"У {alternative['event_id']} пропусков/отказов за 180 дней: {alternative['recent_missed']}; это другой следующий шаг к тому же ориентиру, а не замена развития навыков пропущенной активности.")
    return {**candidate, 'reason_codes': reasons, 'priority_explanation': [REASONS[r] for r in reasons], 'explanation': facts}


class RecommendationService:
    def __init__(self, repository, model: RecommendationModel):
        self.repository, self.model = repository, model

    async def recommend(self, employee_id):
        started = monotonic()
        profile, candidates, excluded = build_candidates(self.repository, employee_id)
        mode, failure, rows = 'no_step', None, []
        if candidates:
            mode = 'ai'
            try:
                answer = await asyncio.wait_for(self.model.select(model_context(profile, candidates)), timeout=MODEL_BUDGET_SECONDS)
                rows = validate_selection(answer, candidates)
            except TimeoutError:
                failure = 'timeout'
            except ModelUnavailable as exc:
                failure = exc.reason
            except (ValueError, TypeError, KeyError):
                failure = 'invalid_response'
            if failure:
                mode = 'rules'
                ordered = sorted(candidates, key=lambda c: (-c['score'], c['nearest_date'], c['duration_hours'], c['event_id']))
                rows = [{'event_id': c['event_id'], 'reasons': c['allowed_reasons']} for c in ordered[:3]]
        by_id = {c['event_id']: c for c in candidates}
        result = {'mode': mode, 'label': {'ai': 'AI: рекомендации модели', 'rules': 'Подбор по правилам; AI сейчас недоступен', 'no_step': 'Сейчас нет подходящей активности из каталога — без шага'}[mode],
                'fallback_reason': failure, 'rules_version': RULES_VERSION,
                'model_version': self.model.model, 'dataset_version': profile['dataset_version'],
                'target': profile['trajectory']['target'], 'excluded_reasons': excluded if not candidates else {},
                'recommendations': [explain(by_id[r['event_id']], profile, r['reasons']) for r in rows]}

        result['elapsed_ms'] = round((monotonic() - started) * 1000)
        logger.info('recommendations mode=%s rules=%s dataset=%s model=%s elapsed_ms=%s failure=%s ids=%s', mode, RULES_VERSION, profile['dataset_version'], self.model.model, result['elapsed_ms'], failure, [r['event_id'] for r in rows])
        return result
