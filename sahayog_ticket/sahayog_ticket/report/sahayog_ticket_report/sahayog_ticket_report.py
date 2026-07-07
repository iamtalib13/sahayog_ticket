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
        {"fieldname": "status", "label": "Status", "fieldtype": "Data", "width": 100},
        {"fieldname": "tat", "label": "TAT", "fieldtype": "Int", "width": 180},
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
        {"fieldname": "total_days", "label": "Ticket Age (Days)", "fieldtype": "Int", "width": 150},
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
    if filters:
        conditions = []

        # Filter by ticket status
        if filters.get("status"):
            conditions.append(f"st.status = '{filters['status']}'")

        # Filter by priority level
        if filters.get("priority"):
            conditions.append(f"st.priority = '{filters['priority']}'")

        # Filter by organizational division (from Employee)
        if filters.get("division"):
            conditions.append(f"emp.custom_division = '{filters['division']}'")

        # Filter by ticket type
        if filters.get("ticket_type"):
            conditions.append(f"st.ticket_type = '{filters['ticket_type']}'")

        # Filter by employee ID
        if filters.get("employee_id"):
            conditions.append(f"st.employee_id = '{filters['employee_id']}'")

        # Filter by employee name (from Employee)
        if filters.get("employee_name"):
            conditions.append(f"emp.employee_name LIKE '%%{filters['employee_name']}%%'")

        # Filter by branch name (from Employee)
        if filters.get("branch_name"):
            conditions.append(f"emp.branch = '{filters['branch_name']}'")

        # Filter by ticket department
        if filters.get("department"):
            conditions.append(f"st.dept_name = '{filters['department']}'")

        # Filter by zone (from Employee)
        if filters.get("zone"):
            conditions.append(f"emp.custom_zone = '{filters['zone']}'")

        # Filter by region (from Employee)
        if filters.get("region"):
            conditions.append(f"emp.custom_region = '{filters['region']}'")

        # Filter by assigned user
        if filters.get("assigned_to"):
            conditions.append(f"st.assigned_to = '{filters['assigned_to']}'")

        # Handle date range filtering
        from_date = filters.get("from_date")
        to_date = filters.get("to_date")

        # Validate and apply date range filters
        if from_date and to_date:
            if from_date > to_date:
                frappe.throw("From Date cannot be after To Date")
            conditions.append(f"st.creation BETWEEN '{from_date} 00:00:00' AND '{to_date} 23:59:59'")
        elif from_date:
            conditions.append(f"st.creation >= '{from_date} 00:00:00'")
        elif to_date:
            conditions.append(f"st.creation <= '{to_date} 23:59:59'")

        # Add WHERE clause if conditions exist
        if conditions:
            query += " WHERE " + " AND ".join(conditions)

    # Order results by creation date (newest first)
    query += " ORDER BY st.creation DESC"

    # Execute query and return results
    data = frappe.db.sql(query, as_dict=True)

    return columns, data
