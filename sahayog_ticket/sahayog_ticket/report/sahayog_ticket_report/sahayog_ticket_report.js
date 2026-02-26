frappe.query_reports["Sahayog Ticket Report"] = {
  // Filter definitions for report data filtering
  filters: [
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: "\nOpen\nIn-Progress\nResolved\nClosed\nCancelled",
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
};
