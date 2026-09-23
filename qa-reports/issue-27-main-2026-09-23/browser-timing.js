// CUA REPL: bind ptab to the observed localhost acceptance tab through browser.tabs.get.
// Start on account selection; perform one manual E0043 login/logout as warm-up.
// Locators are from the observed DOM of pinned revision 3c98153.
const samples = [];
for (let iteration = 1; iteration <= 20; iteration++) {
  let start = Date.now();
  await ptab.playwright.getByRole('button', {name: 'AA Aidos Akhmetov Frontend Engineer · Senior · Frontend Development E0043', exact: true}).click();
  await ptab.playwright.getByRole('heading', {name: 'История активностей', exact: true}).waitFor({state: 'visible'});
  let duration_ms = Date.now() - start;
  samples.push({iteration, action: 'open E0043 profile', duration_ms, status: duration_ms <= 2000 ? 'пройден' : 'не пройден'});
  start = Date.now();
  await ptab.playwright.getByRole('button', {name: 'AA Aidos Akhmetov', exact: true}).click();
  await ptab.playwright.getByRole('heading', {name: 'Рост начинается с вас.', exact: true}).waitFor({state: 'visible'});
  duration_ms = Date.now() - start;
  samples.push({iteration, action: 'return to account selection', duration_ms, status: duration_ms <= 2000 ? 'пройден' : 'не пройден'});
}
nodeRepl.write(samples);
