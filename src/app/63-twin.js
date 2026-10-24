/* One open copy at a time (TabGuard, vendored from JS-modules). Two copies of the page share one browser store, and the last to save would win. The second copy keeps working but saves nothing, and offers "Use this tab". */
var twinGuard = null;
function twinCard() {
  var dlg = $('dlg'), body = $('dlg-body'); if (dlg.open) return;
  var close = function () { try { dlg.close(); } catch (e) { /* closed */ } };
  mount(body, [h('h3', { id: 'dlg-h' }, 'Open in another tab'),
    h('p', null, 'Netflow Map is open in another tab or window. If you work here, nothing is saved in this browser, so the other copy would win. Use this tab instead, or close one of them.'),
    h('div', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'wrap' } }, [
      h('button', { class: 'sm', onclick: close }, 'Keep working without saving'),
      h('button', { class: 'primary', onclick: function () { close(); if (twinGuard && twinGuard.takeOver) twinGuard.takeOver(); else TWIN = false; } }, 'Use this tab')])]);
  dlg.showModal();
}
function startTwinGuard() {
  if (typeof TabGuard !== 'object' || (navigator.webdriver && !/[?&]twin=on/.test(location.search)) || /[?&]notwin/.test(location.search)) return;
  twinGuard = TabGuard.start({ name: 'netflow-map-open', onTwin: function () { TWIN = true; twinCard(); }, onTakeOver: function () { location.reload(); } });
}
