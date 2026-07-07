frappe.query_reports["Sahayog Ticket Report"] = {
  get_datatable_options(options) {
    options.columns = options.columns.map((col) => {
      if (col.fieldname === "status") {
        col.formatter = (value) => {
          const colors = {
            Open: "blue",
            "In-Progress": "orange",
            Resolved: "green",
            Closed: "gray",
          };
          const color = colors[value] || "gray";
          return `<span class="indicator-pill whitespace-nowrap" style="background-color: var(--${color}); color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${value}</span>`;
        };
      }
      return col;
    });
    return options;
  },
  // Filter definitions for report data filtering
  filters: [
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
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: "\nOpen\nIn-Progress\nResolved\nClosed",
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
      fieldtype: "Link",
      options: "Branch",
    },
    {
      fieldname: "department",
      label: "Ticket Department",
      fieldtype: "Link",
      options: "Departsection",
    },
    {
      fieldname: "zone",
      label: "Zone",
      fieldtype: "Link",
      options: "Zone",
    },
    {
      fieldname: "region",
      label: "Region",
      fieldtype: "Link",
      options: "Region",
    },
    {
      fieldname: "assigned_to",
      label: "Assigned To",
      fieldtype: "Link",
      options: "User",
    },
  ],
};
