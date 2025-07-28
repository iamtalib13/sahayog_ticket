# Copyright (c) 2025, Talib Sheikh
# For license information, please see license.txt

import frappe
from frappe.utils import getdate, format_datetime


def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {"fieldname": "ticket_id", "label": "Ticket ID", "fieldtype": "Link", "options": "Sahayog Ticket", "width": 120},
        {"fieldname": "status", "label": "Ticket Status", "fieldtype": "Data", "width": 100},
        {"fieldname": "priority", "label": "Priority", "fieldtype": "Data", "width": 100},
        {"fieldname": "employee_id", "label": "Employee ID", "fieldtype": "Data", "width": 100},
        {"fieldname": "employee_name", "label": "Employee Name", "fieldtype": "Data", "width": 150},
        {"fieldname": "designation", "label": "Designation", "fieldtype": "Data", "width": 150},
        {"fieldname": "emp_department", "label": "Employee Department", "fieldtype": "Data", "width": 150},
        {"fieldname": "branch_name", "label": "Branch", "fieldtype": "Data", "width": 150},
        {"fieldname": "division", "label": "Division", "fieldtype": "Data", "width": 150},
        {"fieldname": "dept_name", "label": "Ticket Department", "fieldtype": "Data", "width": 150},
        {"fieldname": "ticket_type", "label": "Ticket Type", "fieldtype": "Link", "options": "Ticket Type", "width": 150},
        {"fieldname": "description", "label": "Description", "fieldtype": "Data", "width": 200},
        {"fieldname": "ticket_resolved_user", "label": "Resolved By", "fieldtype": "Data", "width": 150},
        {"fieldname": "resolved_remark", "label": "Resolved Remark", "fieldtype": "Data", "width": 200},
        {"fieldname": "executive_remark", "label": "Executive Remark", "fieldtype": "Data", "width": 200},
        {"fieldname": "tat", "label": "TAT", "fieldtype": "Data", "width": 100},
        {"fieldname": "total_days", "label": "Ticket Age", "fieldtype": "Int", "width": 100},
        {"fieldname": "creation_formatted", "label": "Created On", "fieldtype": "Data", "width": 180},
    ]


def get_data(filters):
    conditions = get_conditions(filters)

    query = f"""
        SELECT
            name AS ticket_id,
            status,
            priority,
            employee_id,
            employee_name,
            designation,
            emp_department,
            branch_name,
            division,
            dept_name,
            ticket_type,
            description,
            ticket_resolved_user,
            resolved_remark,
            executive_remark,
            tat,
            total_days,
            creation
        FROM
            `tabSahayog Ticket`
        {f"WHERE {conditions}" if conditions else ""}
        ORDER BY
            creation DESC
    """

    data = frappe.db.sql(query, as_dict=True)

    # Format the datetime for "Created On"
    for row in data:
        if row.get("creation"):
            row["creation_formatted"] = format_datetime(row["creation"], "dd/MM/yyyy hh:mm a")

    return data


def get_conditions(filters):
    if not filters:
        return ""

    conditions = []
    validate_dates(filters)

    def add(field, db_field=None):
        if filters.get(field):
            column = db_field or field
            conditions.append(f"{column} = {frappe.db.escape(filters[field])}")

    add("status")
    add("priority")
    add("division")
    add("ticket_type")
    add("employee_id")
    add("employee_name")
    add("branch_name")
    add("department", db_field="dept_name")

    from_date = filters.get("from_date")
    to_date = filters.get("to_date")

    if from_date and to_date:
        conditions.append(f"creation BETWEEN '{from_date} 00:00:00' AND '{to_date} 23:59:59'")
    elif from_date:
        conditions.append(f"creation >= '{from_date} 00:00:00'")
    elif to_date:
        conditions.append(f"creation <= '{to_date} 23:59:59'")

    return " AND ".join(conditions)


def validate_dates(filters):
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")

    if from_date and to_date and getdate(from_date) > getdate(to_date):
        frappe.throw("From Date cannot be after To Date")
