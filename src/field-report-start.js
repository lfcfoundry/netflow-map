/* Copyright (c) 2026 LFC Foundry. MIT License. Starts the shared field-report (vendor/field-report.js) the moment the page runs, so start-up errors are caught: five quick taps in the top-left corner of the page open Save speed report and Save error log. The frame loop is off (the map draws only when something changes, so a loop would keep the page awake); the report still has start-up times, heavy tasks and every error. */
(function () {
  'use strict';
  if (typeof FieldReport === 'undefined') return;
  try { window.NFMReport = FieldReport.start({ name: 'netflow-map', version: '@@VERSION@@', frames: false }); } catch (e) { /* the report is optional */ }
})();
