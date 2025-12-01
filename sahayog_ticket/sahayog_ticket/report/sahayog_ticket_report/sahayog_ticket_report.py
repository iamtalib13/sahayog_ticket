# Copyright (c) 2025, Talib Sheikh
# For license information, please see license.txt

import frappe
from frappe.utils import getdate, format_datetime, nowdate
from datetime import datetime

def execute(filters=None):
    if not filters:
        filters = {}

    # If no from_date or to_date provided, set to current month by default
    if not filters.get("from_date"):
        today = getdate(nowdate())
        filters["from_date"] = today.replace(day=1).strftime("%Y-%m-%d")
    if not filters.get("to_date"):
        filters["to_date"] = nowdate()

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

        # ➤ Added ONLY this new column
        {"fieldname": "ticket_resolved_on_formatted", "label": "Resolved On", "fieldtype": "Data", "width": 180},
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
            creation,
            ticket_resolved_on  -- ➤ Added ONLY this line
        FROM `tabSahayog Ticket`
        {f"WHERE {conditions}" if conditions else ""}
        ORDER BY creation DESC
    """

    data = frappe.db.sql(query, as_dict=True)

    for row in data:
        if row.get("creation"):
            row["creation_formatted"] = format_datetime(row["creation"], "dd/MM/yyyy hh:mm a")

        # ➤ Added ONLY this block
        if row.get("ticket_resolved_on"):
            row["ticket_resolved_on_formatted"] = format_datetime(
                row["ticket_resolved_on"], "dd/MM/yyyy hh:mm a"
            )

    return data


def get_conditions(filters):
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

    if filters.get("from_date") and filters.get("to_date"):
        conditions.append(f"creation BETWEEN '{filters['from_date']} 00:00:00' AND '{filters['to_date']} 23:59:59'")
    elif filters.get("from_date"):
        conditions.append(f"creation >= '{filters['from_date']} 00:00:00'")
    elif filters.get("to_date"):
        conditions.append(f"creation <= '{filters['to_date']} 23:59:59'")

    return " AND ".join(conditions)


def validate_dates(filters):
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    if from_date and to_date and getdate(from_date) > getdate(to_date):
        frappe.throw("From Date cannot be after To Date")
