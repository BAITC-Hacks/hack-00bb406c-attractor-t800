import { writeFile } from 'node:fs/promises';
import { SKILLS, POSITIONS, SOURCE_NOTE } from './catalog.mjs';
import { exportPromptLibrary } from './prompts.mjs';
import { assessmentSchema } from './assessment.mjs';

const library = exportPromptLibrary();
// The schema is generated from the same code as real API requests.
library.exampleSchema = assessmentSchema({ positionId: 'middle-frontend', skillId: 'architecture', level: 'middle', language: 'ru', questionCount: 10 });
await writeFile(new URL('./prompt-library.json', import.meta.url), JSON.stringify(library, null, 2) + '\n');
const markdown = `# Career Quest — roles, skills and generation prompts

${SOURCE_NOTE}

Source: supplied team-ui-brief.md (four application personas, plus a reference to the Senior career level) and ../mock-data.json (four distinct demo job titles). The brief is source material; its screen-building instructions are not part of this implementation's scope. It contains no complete employee-position list and no formal skill requirements.

## Roles and proposed skill mapping

| Role or position | Evidence | Proposed tests |
| --- | --- | --- |
${POSITIONS.map(position => `| ${position.title} | ${position.source === 'brief' ? 'Brief persona' : 'Existing demo position'} | ${position.skills.map(id => SKILLS.find(skill => skill.id === id).title).join('; ')} |`).join('\n')}

All 16 existing demo tests have a separate specialized prompt. Six additional tests are proposed from responsibilities described in the brief: evidence validation, goal planning, team result analysis, career development, competency mapping and learning effectiveness. This is a prototype matrix, not Halyk's approved framework. Analyst here means the result-verification persona; it does not establish a separate Data Analyst or Business Analyst position.

## How to use the prompts

Each request uses the shared system prompt plus exactly one skill prompt below. Replace role, role context, level, difficulty, language and question-count placeholders. Questions per test: 5–20. Supported languages: Russian, English, Kazakh. Difficulty guidance is included in the JSON export. One role can require multiple tests; shared skills reuse the same template with different role context.

Use the Responses API with Structured Outputs and the schema returned by assessmentSchema(config). The response contains title, instructions and questions; every question has id, text, topic, four options, a zero-based correct index and an explanation. Passing threshold is 80%, configured in code. Questions must cover all four skill topics. Validate model output before displaying it.

## Shared system prompt

\`\`\`text
${library.system}
\`\`\`

${library.prompts.map((prompt, index) => `## ${index + 1}. ${prompt.title}\n\nID: ${prompt.skillId} · Source: ${prompt.source}\n\n\`\`\`text\n${prompt.template}\n\`\`\``).join('\n\n')}

## API references

- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
`;
await writeFile(new URL('./PROMPTS.md', import.meta.url), markdown);
console.log(`Exported ${library.prompts.length} prompts and ${POSITIONS.length} role mappings.`);
