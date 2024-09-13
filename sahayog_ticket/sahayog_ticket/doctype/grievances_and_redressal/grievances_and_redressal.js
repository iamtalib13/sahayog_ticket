// Copyright (c) 2024, Talib Sheikh and contributors
// For license information, please see license.txt

frappe.ui.form.on("Grievances and Redressal", {
  refresh: function (frm) {
    frm.trigger("section_colors");
  },

  section_colors: function (frm) {},
});
