frappe.query_reports["Sahayog Ticket Report"] = {
  filters: [
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: "\nOpen\nIn Progress\nClosed",
      default: "",
    },
    {
      fieldname: "priority",
      label: "Priority",
      fieldtype: "Select",
      options: "\nLow\nMedium\nHigh",
      default: "",
    },
    {
      fieldname: "division",
      label: "Division",
      fieldtype: "Data",
    },
    {
      fieldname: "ticket_type",
      label: "Ticket Type",
      fieldtype: "Link",
      options: "Ticket Type",
    },
    {
      fieldname: "employee_id",
      label: "Employee ID",
      fieldtype: "Data",
    },
    {
      fieldname: "employee_name",
      label: "Employee Name",
      fieldtype: "Data",
    },
    {
      fieldname: "branch_name",
      label: "Branch Name",
      fieldtype: "Data",
    },
    {
      fieldname: "department",
      label: "Department",
      fieldtype: "Link",
      options: "Departsection", // link to your actual Doctype
    },
    {
      fieldname: "zone",
      label: "Zone",
      fieldtype: "Link",
      options: "Zone", // replace with actual Doctype name if different
    },
    {
      fieldname: "region",
      label: "Region",
      fieldtype: "Link",
      options: "Region",
    },
    {
      fieldname: "from_date",
      label: "From Date",
      fieldtype: "Date",
      default: frappe.datetime.add_days(frappe.datetime.nowdate(), -30),
      reqd: 1,
    },
    {
      fieldname: "to_date",
      label: "To Date",
      fieldtype: "Date",
      default: frappe.datetime.nowdate(),
      reqd: 1,
    },
  ],

  onload: function (report) {
    report.page.add_inner_button("Apply Date Filter", function () {
      let filters = frappe.query_report.get_filter_values();

      // Validate From Date & To Date
      if (
        filters.from_date &&
        filters.to_date &&
        filters.from_date > filters.to_date
      ) {
        frappe.msgprint({
          title: __("Validation Error"),
          message: __("From Date cannot be greater than To Date"),
          indicator: "red",
        });
        return;
      }

      frappe.query_report.refresh();
    });
  },
};
