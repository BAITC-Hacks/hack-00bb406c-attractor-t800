# Browser observations

Chrome loaded the local Career Quest page at `http://localhost:8080/`.

- Search for E0174 displayed “Alibek Mukanov · Sales Manager · Junior · Sales”; profile showed ID E0174, the official career goal “Sales Manager · Middle”, the employee's source activity history, and 5 history rows.
- Search for E0003 displayed “Symbat Omarova · Customer Support Specialist · Senior · Customer Support”; profile showed that no career goal was set and displayed 12 total history records (the latest 8 are listed on screen).
- Switched back to E0174; profile identity remained E0174 after browser reload and after restarting the API container.
- Desktop screenshot showed the sidebar, career panel, summary cards, skill list and history without visible overlap or clipped controls.

The browser automation returned an accessibility tree and inline screenshot. A screenshot file was not persisted; browser console and network panels were not exposed by the selected control surface.
