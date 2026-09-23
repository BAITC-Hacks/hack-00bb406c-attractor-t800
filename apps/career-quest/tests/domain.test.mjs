import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, TESTS, submitTest, getMonthlyAttempt, nextMonth, getEmployeeScope, restoreState } from '../src/domain.js';

const answer = (id, correct=true) => TESTS.find(t=>t.id===id).questions.map(q=>correct?q.correct:(q.correct+1)%q.options.length);
const submit = (state, testId='system-design', extra={}) => submitTest(state,{employeeId:'arman',testId,answers:answer(testId),attemptId:'attempt-1',submittedAt:`${state.month}-01T10:00:00.000Z`,...extra});
test('all catalog tests have meaningful, valid complete answer sets',()=>{
  assert.ok(TESTS.length>=8);
  for(const t of TESTS){assert.ok(t.questions.length>=4);assert.equal(new Set(t.questions.map(q=>q.id)).size,t.questions.length);for(const q of t.questions){assert.ok(q.options[q.correct]);assert.ok(q.explanation.length>20);}}
});
test('pass confirms a new skill without mutating the original or promoting employee',()=>{
 const before=initialState(),{state,result}=submit(before);
 assert.equal(result.score,100);assert.equal(result.passed,true);assert.equal(before.employees[0].skills.length,5);
 assert.equal(state.employees[0].skills.length,6);assert.equal(state.employees[0].grade,'Middle');assert.equal(getMonthlyAttempt(state,'arman').testId,'system-design');
});
test('one total attempt across tests per employee per month, including failure',()=>{
 const {state,result}=submit(initialState(),'system-design',{answers:answer('system-design',false)});
 assert.equal(result.passed,false);assert.equal(state.employees[0].skills.length,5);
 assert.throws(()=>submit(state,'python',{attemptId:'different'}),/месяц/);
 const advanced=nextMonth(state);assert.equal(advanced.month,'2026-11');assert.doesNotThrow(()=>submit(advanced,'python',{attemptId:'november'}));
});
test('duplicate attempt is idempotent; replay against another test is rejected',()=>{
 const {state,result}=submit(initialState());const replay=submit(state);
 assert.equal(replay.state,state);assert.deepEqual(replay.result,result);assert.equal(state.attempts.length,1);
 assert.throws(()=>submit(state,'python'),/идентификатор/);
});
test('invalid or incomplete answers and mismatched dates do not consume attempt',()=>{
 const state=initialState();
 for(const answers of [[],[0],[99,99,99,99],[0,0,0,0,0,0]]) assert.throws(()=>submit(state,'system-design',{answers}));
 assert.throws(()=>submit(state,'system-design',{submittedAt:'2025-01-01T00:00:00Z'}));assert.equal(state.attempts.length,0);
});
test('confirmed existing skill does not duplicate or downgrade',()=>{
 const state=initialState();state.employees[0].skills.find(s=>s.id==='python').level=3;
 const {state:updated}=submit(state,'python');assert.equal(updated.employees[0].skills.length,5);assert.equal(updated.employees[0].skills.find(s=>s.id==='python').level,3);
});
test('role scopes isolate direct reports and individual employee',()=>{
 const state=initialState();assert.equal(getEmployeeScope(state,'hr').length,state.employees.length);
 assert.ok(getEmployeeScope(state,'manager','aigerim').every(e=>e.managerId==='aigerim'));
 assert.equal(getEmployeeScope(state,'employee','arman').length,1);assert.equal(getEmployeeScope(state,'unknown').length,0);
});
test('persisted state restores; malformed or tampered state resets safely',()=>{
 const {state}=submit(initialState());assert.deepEqual(restoreState(JSON.stringify(state)),state);
 for(const raw of ['{','null','{}',JSON.stringify({...state,employees:[{}]}),JSON.stringify({...state,month:'2026-99'})]) assert.equal(restoreState(raw).attempts.length,0);
});
test('December rolls into next year',()=>{assert.equal(nextMonth({...initialState(),month:'2026-12'}).month,'2027-01');});
test('every catalog test can be completed and exactly 80 is a passing score',()=>{
 for(const t of TESTS){const answers=answer(t.id);answers[0]=(answers[0]+1)%t.questions[0].options.length;const {result}=submit(initialState(),t.id,{answers});assert.equal(result.score,80);assert.equal(result.passed,true);}
});
test('monthly allowance is per employee, not shared by a department',()=>{
 const {state}=submit(initialState());const {state:next}=submit(state,'python',{employeeId:'dana',attemptId:'dana-oct'});
 assert.equal(next.attempts.length,2);assert.equal(getMonthlyAttempt(next,'dana').testId,'python');
});
test('lower passing retest preserves best score and its actual confirmation date',()=>{
 const state=initialState(),old=structuredClone(state.employees[0].skills.find(s=>s.id==='python'));
 const answers=answer('python');answers[0]=(answers[0]+1)%4;
 const {state:next,result}=submit(state,'python',{answers});
 assert.equal(result.score,80);const s=next.employees[0].skills.find(s=>s.id==='python');
 assert.equal(s.score,old.score);assert.equal(s.date,old.date);assert.equal(next.employees[0].history[0].score,80);
});
test('malformed persisted nested collections reset before rendering can fail',()=>{
 for(const patch of [{meetings:[null]},{meetings:[{id:'x',employeeId:'arman',topic:{},date:'bad',time:'??'}]},{attempts:[null]},{employees:initialState().employees.map((e,i)=>i?e:{...e,skills:[null]})}])assert.deepEqual(restoreState(JSON.stringify({...initialState(),...patch})),initialState());
});
test('persisted false confirmation and fabricated score cannot become accepted skills',()=>{
 const s=initialState();s.employees[0].history[0].passed=false;
 assert.deepEqual(restoreState(JSON.stringify(s)),initialState());
 const {state}=submit(initialState());state.attempts[0].score=80;
 assert.deepEqual(restoreState(JSON.stringify(state)),initialState());
});
test('learning progress survives restore without confirming skills or giving points',()=>{
 const state=initialState();state.learning={'system-design':[0,2,4]};
 const restored=restoreState(JSON.stringify(state));assert.deepEqual(restored.learning,state.learning);assert.equal(restored.employees[0].skills.length,5);assert.deepEqual(restored.points,[]);
 const {learning,...legacy}=initialState();assert.deepEqual(restoreState(JSON.stringify(legacy)).learning,{});
});
test('malformed learning progress resets safely',()=>{
 for(const learning of [null,[],{'unknown':[0]},{python:[0,0]},{python:[5]},{python:[-1]},{python:['0']},{python:{}}])assert.deepEqual(restoreState(JSON.stringify({...initialState(),learning})),initialState());
});
