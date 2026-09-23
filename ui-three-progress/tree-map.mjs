const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Tenure selects a complete photograph; tests add badges, never drawn foliage.
export const treeScale = months => Math.min(1, .88 + Math.max(0, months) / 200);
export const treeFrame = (artwork, months) => artwork.stages.filter(stage => months >= stage.minMonths).at(-1) || artwork.stages[0];

export function skillTree(tests, { months, theme, highlight, artwork }) {
  const frame = treeFrame(artwork, months);
  const passed = tests.filter(test => test.status === 'passed');
  const visible = passed.slice(-10);
  const newest = passed.find(test => test.id === highlight);
  if (newest && !visible.includes(newest)) visible[0] = newest;
  const remaining = passed.length - visible.length;
  return `<section class="tree-hero-screen ${esc(theme)}" aria-label="Дерево навыков">
    <div class="tree-portrait" style="--tenure-scale:${treeScale(months)};--badge-top:${frame.badgeTop}%;--badge-bottom:${frame.badgeBottom}%">
      <div class="living-tree">
        <img class="phone-tree-image" src="${esc(frame.asset)}" alt="${esc(artwork.name)} — ${frame.id==='young'?'молодое':'взрослое'} дерево" width="${frame.width}" height="${frame.height}" fetchpriority="high" draggable="false">
        <div class="tree-achievements" aria-label="Пройденные тесты на дереве">
          ${visible.map(test => `<button class="tree-achievement ${highlight===test.id?'achievement-arriving':''}" data-achievement-id="${esc(test.id)}" data-action="test-open" data-id="${esc(test.id)}" aria-label="${esc(test.title)} · Пройдено"><span aria-hidden="true">✓</span><span>${esc(test.badgeLabel || test.title)}</span></button>`).join('')}
          ${remaining?`<button class="tree-achievement tree-achievements-more" data-action="tree-passed" aria-label="Показать все ${passed.length} пройденных тестов">+${remaining}</button>`:''}
        </div>
      </div>
    </div>
    <button class="tree-scroll-cue" data-action="tree-details" aria-label="Прокрутить к информации о дереве"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M12 4v15m-5-5 5 5 5-5"/></svg></button>
  </section>`;
}
