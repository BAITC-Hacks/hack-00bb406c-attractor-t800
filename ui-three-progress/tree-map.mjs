import { treeLayout } from './growth-model.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Leaves are actual skill state, not painted into the background asset.
// Every pair of skills grows another branch row, without a skill-count limit.
export function skillTree(tests, { months, species, theme, highlight }) {
  const { height, nodes, size, passed } = treeLayout(tests, months);
  const root = height - 80;
  const stem = `M400 ${root} C425 ${root - 170} 366 ${height * .65} 399 ${height * .49} S420 180 400 18`;
  const trunk = `M400 18 C389 175 425 ${height*.3} 390 ${height*.48} S418 ${height*.77} ${400-15*size} ${root} Q400 ${root+10} ${400+20*size} ${root} C395 ${height*.77} 418 ${height*.66} 406 ${height*.48} S414 175 400 18Z`;
  const leaf = species === 'oak' ? 'M0 0C-15 -1 -33 -10 -29 -18C-41 -26 -28 -34 -34 -43C-24 -42 -26 -57 -14 -57C-19 -69 -4 -70 0 -84C5 -70 18 -68 14 -57C29 -58 24 -43 34 -43C27 -32 41 -26 29 -18C33 -10 15 -1 0 0Z' : species === 'pine' ? 'M0 0L-23 -21L-10 -20L-29 -39L-13 -37L-24 -55L-10 -52L0 -88L10 -52L24 -55L13 -37L29 -39L10 -20L23 -21Z' : 'M0 0C-44 -20 -32 -59 0 -84C32 -59 44 -20 0 0Z';
  const colors = theme === 'autumn' ? ['#ba8137', '#6e451c'] : theme === 'night' ? ['#7faf93', '#244b3b'] : ['#5d885c', '#173f2d'];
  const branches = nodes.map(n => {
    const originY = Math.min(root - 40, n.y + 160);
    const bendX = 400 + n.side * 96;
    const curve = `M400 ${originY} C${bendX} ${originY - 4} ${400+n.side*54} ${n.y+83} ${n.x-n.side*45} ${n.y+43} S${n.x-n.side*18} ${n.y+20} ${n.x} ${n.y}`;
    return `<g><path d="${curve}" class="branch-shadow" stroke-width="${(11 - n.row * .24) * size}"/><path d="${curve}" stroke="url(#bark)" stroke-width="${(8 - Math.min(4,n.row * .24)) * size}"/><path d="M${400 + n.side * 92} ${originY - 39}q${n.side * 20} -54 ${n.side * 8} -89" stroke="#a69c83" stroke-width="1.7"/></g>`;
  }).join('');
  const leaves = nodes.map(n => `<g class="map-leaf ${n.status} ${highlight === n.id ? 'new-leaf' : ''}" data-leaf-id="${esc(n.id)}" transform="translate(${n.x} ${n.y}) rotate(${-n.side * 25}) scale(${size * .78})"><path d="${leaf}" fill="${n.status === 'passed' ? 'url(#leaf-fill)' : 'none'}" stroke="${n.status === 'failed' ? '#b87a58' : n.status === 'passed' ? colors[1] : '#a6b5a0'}" stroke-width="${n.status === 'passed' ? 1 : 1.4}" ${n.status === 'new' ? 'stroke-dasharray="3 3"' : ''}/>${n.status === 'passed' ? '<path d="M0 -4V-76M0 -16l-18 -12M0 -30l19 -14M0 -43l-15 -13M0 -57l10 -10" fill="none" stroke="#d3d9b0" stroke-opacity=".5" stroke-width=".8"/>' : ''}</g>`).join('');
  return `<div class="botanical-map ${esc(theme)} species-${esc(species)}" style="--map-height:${height}px" aria-label="Дерево навыков: ${passed} листьев, ${tests.length} навыков">
    <svg class="branch-art" viewBox="0 0 800 ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="bark"><stop stop-color="#b1a189"/><stop offset=".3" stop-color="#635e49"/><stop offset=".5" stop-color="#9c9277"/><stop offset=".8" stop-color="#504d3b"/><stop offset="1" stop-color="#b3aa93"/></linearGradient><linearGradient id="leaf-fill" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="${colors[0]}"/><stop offset=".5" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[0]}"/></linearGradient></defs><g fill="none" stroke-linecap="round"><path d="${stem}" class="branch-shadow" stroke-width="${25 * size}"/><path d="${trunk}" fill="url(#bark)" stroke="#8c8169" stroke-width="1"/><path d="M399 ${root}q-19 29 -105 45m109 -45q37 37 108 48m-112 -45q10 33 -13 64" stroke="url(#bark)" stroke-width="${10 * size}"/>${branches}<path d="${stem}" stroke="#eee5cc" stroke-opacity=".3" stroke-width="1.2" stroke-dasharray="35 14 9 8"/></g>${leaves}</svg>
    ${nodes.map(n => `<button class="skill-label ${n.status} side-${n.side === 1 ? 'right' : 'left'}" style="--node-y:${n.y}px" data-action="test-open" data-id="${esc(n.id)}" aria-label="${esc(n.title)} · ${n.status === 'passed' ? 'Пройдено, лист получен' : n.status === 'failed' ? 'Повторить тест' : 'Не начато'}"><span class="skill-index">${String(nodes.indexOf(n) + 1).padStart(2,'0')} / ${n.required ? 'РОЛЬ' : 'НА ВЫБОР'}</span><span class="skill-name">${esc(n.title)} <i>${n.status === 'passed' ? '✓' : n.status === 'failed' ? '↻' : '+'}</i></span><span class="skill-state">${n.status === 'passed' ? `Подтверждён · ${n.score}%` : n.status === 'failed' ? `Повторить · ${n.score}%` : `Пройти тест · +${n.xp} XP`}</span></button>`).join('')}
    <div class="tree-roots"><span>${months} месяцев в Halyk</span><p>Стаж укрепляет корни.<br>Знания раскрывают новые листья.</p></div>
  </div>`;
}
