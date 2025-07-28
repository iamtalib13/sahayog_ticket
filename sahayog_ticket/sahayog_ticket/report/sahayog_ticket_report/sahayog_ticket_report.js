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
      options: "Departsection", // ✅ Link to actual DocType
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
