/* Copyright (c) 2026 LFC Foundry. MIT License. Needs bench/core-plan.js before it.
 * Puts "This device reports N threads (about M cores assumed) and X GB" at the top of a tester page, offers it as the first line of
 * Copy results (LfcDevice.prefix), and keeps a "last run" line: LfcDevice.step('name') before each race, LfcDevice.done() after the run. */
(function () {
  'use strict';
  var P = window.LfcCorePlan, plan = P.plan(), line = plan.label.split('. Plan:')[0] + '.', prev = P.lastRun.previous();
  window.LfcDevice = {
    line: line, plan: plan, previous: prev,
    prefix: function (md) { return line + '\n\n' + md; },
    step: function (n) { P.lastRun.step(n); },
    done: function () { P.lastRun.done(); }
  };
  function show() {
    var d = document.createElement('div');
    d.id = 'lfc-device'; d.setAttribute('style', 'margin:0 0 12px;padding:10px 14px;border-left:4px solid #2c6fd4;background:rgba(128,128,128,.14);font:14px/1.45 system-ui,sans-serif');
    d.textContent = line + (prev ? ' ' + prev : '');
    var b = document.body; b.insertBefore(d, b.firstChild);
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
