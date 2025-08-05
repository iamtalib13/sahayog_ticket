import frappe

def execute(filters=None):
    columns = [
        {"fieldname": "ticket_id", "label": "Ticket ID", "fieldtype": "Link", "options": "Sahayog Ticket", "width": 120},
        {"fieldname": "status", "label": "Status", "fieldtype": "Data", "width": 100},
        {"fieldname": "priority", "label": "Priority", "fieldtype": "Data", "width": 100},
        {"fieldname": "employee_id", "label": "Employee ID", "fieldtype": "Data", "width": 100},
        {"fieldname": "employee_name", "label": "Employee Name", "fieldtype": "Data", "width": 150},
        {"fieldname": "designation", "label": "Designation", "fieldtype": "Data", "width": 150},
        {"fieldname": "emp_department", "label": "Employee Department", "fieldtype": "Data", "width": 150},
        {"fieldname": "branch_name", "label": "Branch", "fieldtype": "Data", "width": 150},
        {"fieldname": "zone", "label": "Zone", "fieldtype": "Data", "width": 120},
        {"fieldname": "region", "label": "Region", "fieldtype": "Data", "width": 120},
        {"fieldname": "division", "label": "Division", "fieldtype": "Data", "width": 150},
        {"fieldname": "dept_name", "label": "Ticket Department", "fieldtype": "Data", "width": 150},
        {"fieldname": "ticket_type", "label": "Ticket Type", "fieldtype": "Link", "options": "Ticket Type", "width": 150},
        {"fieldname": "description", "label": "Description", "fieldtype": "Data", "width": 200},
        {"fieldname": "ticket_resolved_user", "label": "Resolved By", "fieldtype": "Data", "width": 150},
        {"fieldname": "resolved_remark", "label": "Resolved Remark", "fieldtype": "Data", "width": 200},
        {"fieldname": "tat", "label": "TAT (Estimated Time for Resolution)", "fieldtype": "Int", "width": 180},
        {"fieldname": "total_days", "label": "Ticket Age (Days)", "fieldtype": "Int", "width": 150},
        {"fieldname": "creation", "label": "Created On", "fieldtype": "Datetime", "width": 180},
    ]

    query = """
        SELECT
            name AS ticket_id,
            status,
            priority,
            employee_id,
            employee_name,
            designation,
            emp_department,
            branch_name,
            zone,
            region,
            division,
            dept_name,
            ticket_type,
            description,
            ticket_resolved_user,
            resolved_remark,
            tat,
            total_days,
            creation
        FROM
            `tabSahayog Ticket`
    """

    if filters:
        conditions = []

        if filters.get("status"):
            conditions.append(f"status = '{filters['status']}'")

        if filters.get("priority"):
            conditions.append(f"priority = '{filters['priority']}'")

        if filters.get("division"):
            conditions.append(f"division = '{filters['division']}'")

        if filters.get("ticket_type"):
            conditions.append(f"ticket_type = '{filters['ticket_type']}'")

        if filters.get("employee_id"):
            conditions.append(f"employee_id = '{filters['employee_id']}'")

        if filters.get("employee_name"):
            conditions.append(f"employee_name = '{filters['employee_name']}'")

        if filters.get("branch_name"):
            conditions.append(f"branch_name = '{filters['branch_name']}'")

        if filters.get("department"):
            conditions.append(f"dept_name = '{filters['department']}'")

        if filters.get("zone"):
            conditions.append(f"zone = '{filters['zone']}'")

        if filters.get("region"):
            conditions.append(f"region = '{filters['region']}'")

        from_date = filters.get("from_date")
        to_date = filters.get("to_date")

        if from_date and to_date:
            if from_date > to_date:
                frappe.throw("From Date cannot be after To Date")
            conditions.append(f"creation BETWEEN '{from_date} 00:00:00' AND '{to_date} 23:59:59'")
        elif from_date:
            conditions.append(f"creation >= '{from_date} 00:00:00'")
        elif to_date:
            conditions.append(f"creation <= '{to_date} 23:59:59'")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY creation DESC"

    data = frappe.db.sql(query, as_dict=True)

    return columns, data
