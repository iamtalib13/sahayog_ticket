import frappe


def execute(filters=None):
    """
    Execute Sahayog Ticket Report with filtering and assignment details.
    
    Args:
        filters (dict): Filter criteria for the report
        
    Returns:
        tuple: (columns, data) for the report
    """
    
    # Define report columns with proper field types and widths
    columns = [
        {"fieldname": "ticket_id", "label": "Ticket ID", "fieldtype": "Link", "options": "Sahayog Ticket", "width": 120},
        {"fieldname": "status", "label": "Status", "fieldtype": "Data", "width": 100, "escape_html": 0},
        {"fieldname": "total_days", "label": "Age", "fieldtype": "Int", "width": 60},
        {"fieldname": "tat", "label": "TAT", "fieldtype": "Int", "width": 60},
        {"fieldname": "priority", "label": "Priority", "fieldtype": "Data", "width": 100},
        {"fieldname": "assigned_to_name", "label": "Assigned To", "fieldtype": "Data", "width": 150},
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
        {"fieldname": "creation", "label": "Created On", "fieldtype": "Datetime", "width": 180},
        {"fieldname": "ticket_resolved_on", "label": "Resolved On", "fieldtype": "Datetime", "width": 180},

    ]

    # Base SQL query to fetch ticket data with assigned user full name and employee details from Employee doctype
    query = """
        SELECT
            st.name AS ticket_id,
            st.status,
            st.priority,
            st.employee_id,
            emp.employee_name,
            emp.designation,
            emp.department AS emp_department,
            emp.branch AS branch_name,
            emp.custom_zone AS zone,
            emp.custom_region AS region,
            emp.custom_division AS division,
            st.dept_name,
            st.ticket_type,
            st.description,
            COALESCE(u.full_name, st.assigned_to_name) AS assigned_to_name,
            st.ticket_resolved_user,
            st.ticket_resolved_on,
            st.resolved_remark,
            st.tat,
            st.total_days,
            st.creation
        FROM
            `tabSahayog Ticket` st
        LEFT JOIN
            `tabEmployee` emp ON st.employee_id = emp.employee_number
        LEFT JOIN
            `tabUser` u ON st.assigned_to = u.name
    """

    # Apply filters if provided
    params = []
    if filters:
        conditions = []

        if filters.get("status"):
            conditions.append("st.status = %s")
            params.append(filters["status"])

        if filters.get("priority"):
            conditions.append("st.priority = %s")
            params.append(filters["priority"])

        if filters.get("division"):
            conditions.append("emp.custom_division = %s")
            params.append(filters["division"])

        if filters.get("ticket_type"):
            conditions.append("st.ticket_type = %s")
            params.append(filters["ticket_type"])

        if filters.get("employee_id"):
            conditions.append("st.employee_id = %s")
            params.append(filters["employee_id"])

        if filters.get("employee_name"):
            conditions.append("emp.employee_name LIKE %s")
            params.append(f"%{filters['employee_name']}%")

        if filters.get("branch_name"):
            conditions.append("emp.branch = %s")
            params.append(filters["branch_name"])

        if filters.get("department"):
            conditions.append("st.dept_name = %s")
            params.append(filters["department"])

        if filters.get("zone"):
            conditions.append("emp.custom_zone = %s")
            params.append(filters["zone"])

        if filters.get("region"):
            conditions.append("emp.custom_region = %s")
            params.append(filters["region"])

        if filters.get("assigned_to"):
            conditions.append("st.assigned_to = %s")
            params.append(filters["assigned_to"])

        from_date = filters.get("from_date")
        to_date = filters.get("to_date")

        if from_date and to_date:
            if from_date > to_date:
                frappe.throw("From Date cannot be after To Date")
            conditions.append("st.creation BETWEEN %s AND %s")
            params.extend([f"{from_date} 00:00:00", f"{to_date} 23:59:59"])
        elif from_date:
            conditions.append("st.creation >= %s")
            params.append(f"{from_date} 00:00:00")
        elif to_date:
            conditions.append("st.creation <= %s")
            params.append(f"{to_date} 23:59:59")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY st.creation DESC"

    data = frappe.db.sql(query, params, as_dict=True)

    status_colors = {
        "Open": "#2490ef",
        "In-Progress": "#f59f00",
        "Resolved": "#28a745",
        "Closed": "#98a6ad",
    }

    for row in data:
        status = row.get("status")
        if status and status in status_colors:
            color = status_colors[status]
            row["status"] = f'<span style="background-color:{color}; color:white; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:500;">{status}</span>'

    return columns, data


@frappe.whitelist()
def get_employee_department(user=None):
    if not user:
        user = frappe.session.user
    employee = frappe.db.get_value(
        "Employee",
        {"user_id": user},
        ["department"],
        as_dict=True,
    )
    if employee and employee.department:
        return employee.department
    return None


@frappe.whitelist()
def get_status_counts(department=None, from_date=None, to_date=None):
    conditions = []
    params = []
    if department:
        conditions.append("st.dept_name = %s")
        params.append(department)
    if from_date and to_date:
        conditions.append("st.creation BETWEEN %s AND %s")
        params.extend([f"{from_date} 00:00:00", f"{to_date} 23:59:59"])
    elif from_date:
        conditions.append("st.creation >= %s")
        params.append(f"{from_date} 00:00:00")
    elif to_date:
        conditions.append("st.creation <= %s")
        params.append(f"{to_date} 23:59:59")

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    query = f"""
        SELECT st.status, COUNT(*) as count
        FROM `tabSahayog Ticket` st
        {where}
        GROUP BY st.status
    """
    result = frappe.db.sql(query, params, as_dict=True)
    counts = {"Open": 0, "In-Progress": 0, "Resolved": 0, "Closed": 0}
    for row in result:
        if row.status in counts:
            counts[row.status] = row.count
    return counts
