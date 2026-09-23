// Explicitly invoked fixture generation. Read the credential from stdin; never write it.
import { createInterface } from 'node:readline';
import { readFile, writeFile } from 'node:fs/promises';
import { generateAssessment } from './openai.mjs';
import { POSITIONS } from './catalog.mjs';

const input = createInterface({ input: process.stdin, terminal: false });
let apiKey = await new Promise(resolve => { input.once('line', line => { resolve(line.trim()); input.close(); }); input.once('close', () => resolve('')); });
const path = new URL('../mock-data.json', import.meta.url);
const fixtures = JSON.parse(await readFile(path, 'utf8'));
let completed = 0;
try {
  for (const test of fixtures.tests) {
    const position = POSITIONS.find(p => p.id === 'middle-frontend' && p.skills.includes(test.id)) || POSITIONS.find(p => p.skills.includes(test.id));
    if (!position) continue;
    const assessment = await generateAssessment({ positionId: position.id, skillId: test.id, level: position.level, language: 'ru', questionCount: 5, model: 'gpt-4.1-mini' }, { apiKey });
    const current = JSON.parse(await readFile(path, 'utf8'));
    const target = current.tests.find(t => t.id === test.id);
    target.questionSet = test.id;
    target.generated = { model: assessment.config.model, createdAt: assessment.createdAt, promptVersion: assessment.promptVersion, positionId: position.id };
    current.questions[test.id] = assessment.questions;
    current.testSettings[test.id] = assessment.config;
    await writeFile(path, JSON.stringify(current, null, 2) + '\n');
    console.log(`Generated ${++completed}/${fixtures.tests.length}: ${test.id} (${assessment.questions.length} questions)`);
  }
} catch (error) {
  console.error(`Stopped after ${completed} tests: ${error.message}`);
  process.exitCode = 1;
} finally { apiKey = ''; }
