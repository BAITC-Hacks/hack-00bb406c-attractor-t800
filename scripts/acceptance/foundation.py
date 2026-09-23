"""Foundation-only HTTP checks; run against a disposable local acceptance stack.

Usage: python3 scripts/acceptance/foundation.py http://localhost:18087
No cookies or personal profile contents are printed. This is not a UI benchmark.
"""
import http.cookiejar
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

base = sys.argv[1].rstrip('/')
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def request(path, method='GET', payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(base + path, data=data, method=method,
                                 headers={'Content-Type': 'application/json'})
    try:
        with client.open(req, timeout=10) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def check(name, operation, expected):
    start = time.perf_counter()
    actual = operation()
    result = {'check': name, 'expected': expected, 'actual': actual,
              'duration_ms': round((time.perf_counter() - start) * 1000, 2),
              'status': 'пройден' if actual == expected else 'не пройден'}
    print(json.dumps(result, ensure_ascii=False))
    return actual == expected


print(json.dumps({'started_at': datetime.now(timezone.utc).isoformat(),
                  'environment': 'HTTP, isolated local Docker Compose',
                  'dataset_version': '1.0', 'dataset_date': '2026-10-01'}))
passed = []
passed.append(check('anonymous profile denied', lambda: request('/api/me/profile')[0], 401))
passed.append(check('official account count', lambda: len(request('/api/demo/accounts')[1]), 200))
passed.append(check('employee login', lambda: request('/api/demo/login', 'POST', {'employee_id': 'E0043'})[0], 200))
passed.append(check('own profile', lambda: request('/api/me/profile')[1]['employee']['employee_id'], 'E0043'))
passed.append(check('foreign profile denied', lambda: request('/api/employees/E0174')[0], 403))
passed.append(check('employee clock access denied', lambda: request('/api/operator/clock')[0], 403))
passed.append(check('employee clock mutation denied', lambda: request('/api/operator/clock', 'PUT', {'as_of_date': '2026-10-15'})[0], 403))
old_token = next(cookie.value for cookie in jar if cookie.name == 'cq_session')
passed.append(check('switch identity', lambda: request('/api/demo/login', 'POST', {'employee_id': 'E0174'})[1]['employee_id'], 'E0174'))
passed.append(check('switch rotates token', lambda: next(cookie.value for cookie in jar if cookie.name == 'cq_session') != old_token, True))
passed.append(check('previous profile denied after switch', lambda: request('/api/employees/E0043')[0], 403))
passed.append(check('logout', lambda: request('/api/session', 'DELETE')[0], 200))
passed.append(check('logged-out profile denied', lambda: request('/api/me/profile')[0], 401))
passed.append(check('operator login', lambda: request('/api/demo/login', 'POST', {'operator': True})[0], 200))
passed.append(check('initial controlled date', lambda: request('/api/operator/clock')[1]['as_of_date'], '2026-10-01'))
passed.append(check('set persistence marker', lambda: request('/api/operator/clock', 'PUT', {'as_of_date': '2026-10-15'})[1]['as_of_date'], '2026-10-15'))
# Deliberately leave only this marker in the disposable volume for restart checks.
request('/api/session', 'DELETE')
sys.exit(0 if all(passed) else 1)
