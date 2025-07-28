frappe.query_reports["Sahayog Ticket Report"] = {
  filters: [
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: ["", "Open", "In-Progress", "Resolved", "Closed"],
    },
    {
      fieldname: "priority",
      label: "Priority",
      fieldtype: "Select",
      options: ["", "Low", "Normal", "High", "Urgent"],
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
      fieldtype: "Data",
    },
    {
      fieldname: "from_date",
      label: "From Date",
      fieldtype: "Date",
      default: frappe.datetime.month_start(),
    },
    {
      fieldname: "to_date",
      label: "To Date",
      fieldtype: "Date",
      default: frappe.datetime.get_today(),
    },
  ],
};
