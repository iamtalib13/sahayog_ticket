frappe.listview_settings["Sahayog Ticket"] = {
  // hide_name_column: true,
  refresh: function (listview) {
    // Hide the left sidebar
    $(".layout-side-section").hide();

    // Hide the entire breadcrumb bar
    $("#navbar-breadcrumbs").hide();

    // OR: Hide only the breadcrumb links (same as your CSS)
    $("#navbar-breadcrumbs a").hide(); // this replicates: display: none;
  },
};
