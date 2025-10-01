import frappe
from frappe import _


def execute(filters=None):
    """
    Execute Sahayog Ticket Report with comprehensive filtering and assignment details.
    
    This function generates a detailed report of Sahayog tickets including employee information,
    organizational hierarchy, ticket details, and assignment information. The report supports
    various filters for data analysis and monitoring purposes.
    
    Args:
        filters (dict, optional): Dictionary containing filter criteria for the report.
                                Supported filters include status, priority, dates, employee details,
                                organizational units, and ticket types.
    
    Returns:
        tuple: A tuple containing (columns, data) where:
               - columns: List of column definitions for the report display
               - data: List of dictionaries containing the filtered ticket data
    
    Raises:
        frappe.ValidationError: When from_date is greater than to_date
    """
    
    # Define column structure with proper field types and display widths
    columns = get_columns()
    
    # Build and execute the main query with optional filters
    data = get_ticket_data(filters)
    
    return columns, data


def get_columns():
    """
    Define the column structure for the Sahayog Ticket Report.
    
    Returns:
        list: List of dictionaries defining column properties including
              fieldname, label, fieldtype, options, and width for proper
              display formatting in the report interface.
    """
    return [
        {
            "fieldname": "ticket_id",
            "label": _("Ticket ID"),
            "fieldtype": "Link",
            "options": "Sahayog Ticket",
            "width": 120
        },
        {
            "fieldname": "status",
            "label": _("Status"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "priority",
            "label": _("Priority"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "employee_id",
            "label": _("Employee ID"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "employee_name",
            "label": _("Employee Name"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "designation",
            "label": _("Designation"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "emp_department",
            "label": _("Employee Department"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "branch_name",
            "label": _("Branch"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "zone",
            "label": _("Zone"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "region",
            "label": _("Region"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "division",
            "label": _("Division"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "dept_name",
            "label": _("Ticket Department"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "ticket_type",
            "label": _("Ticket Type"),
            "fieldtype": "Link",
            "options": "Ticket Type",
            "width": 150
        },
        {
            "fieldname": "description",
            "label": _("Description"),
            "fieldtype": "Data",
            "width": 200
        },
        {
            "fieldname": "assigned_to_name",
            "label": _("Assigned To"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "ticket_resolved_user",
            "label": _("Resolved By"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "resolved_remark",
            "label": _("Resolved Remark"),
            "fieldtype": "Data",
            "width": 200
        },
        {
            "fieldname": "tat",
            "label": _("TAT (Estimated Time for Resolution)"),
            "fieldtype": "Int",
            "width": 180
        },
        {
            "fieldname": "total_days",
            "label": _("Ticket Age (Days)"),
            "fieldtype": "Int",
            "width": 150
        },
        {
            "fieldname": "creation",
            "label": _("Created On"),
            "fieldtype": "Datetime",
            "width": 180
        }
    ]


def get_ticket_data(filters):
    """
    Retrieve ticket data based on applied filters.
    
    This function constructs and executes a SQL query to fetch Sahayog ticket
    data with proper filtering and assignment information. It handles date validation
    and builds dynamic WHERE conditions based on provided filters.
    
    Args:
        filters (dict): Dictionary containing filter criteria
        
    Returns:
        list: List of dictionaries containing ticket data matching the filter criteria
        
    Raises:
        frappe.ValidationError: When date range validation fails
    """
    
    # Base query with assignment information using JSON extraction
    base_query = """
        SELECT
            st.name AS ticket_id,
            st.status,
            st.priority,
            st.employee_id,
            st.employee_name,
            st.designation,
            st.emp_department,
            st.branch_name,
            st.zone,
            st.region,
            st.division,
            st.dept_name,
            st.ticket_type,
            st.description,
            CASE 
                WHEN st._assign IS NOT NULL AND st._assign != '[]' 
                THEN (
                    SELECT u.full_name 
                    FROM `tabUser` u 
                    WHERE u.name = JSON_UNQUOTE(JSON_EXTRACT(st._assign, '$[0]'))
                )
                ELSE NULL
            END AS assigned_to_name,
            st.ticket_resolved_user,
            st.resolved_remark,
            st.tat,
            st.total_days,
            st.creation
        FROM
            `tabSahayog Ticket` st
    """
    
    # Build WHERE conditions based on filters
    conditions = build_filter_conditions(filters)
    
    # Construct complete query with conditions and ordering
    if conditions:
        query = base_query + " WHERE " + " AND ".join(conditions)
    else:
        query = base_query
        
    query += " ORDER BY st.creation DESC"
    
    # Execute query and return results
    return frappe.db.sql(query, as_dict=True)


def build_filter_conditions(filters):
    """
    Build SQL WHERE conditions based on provided filters.
    
    This function processes the filter dictionary and creates appropriate
    SQL conditions for each filter type, including proper date range validation
    and string escaping for security.
    
    Args:
        filters (dict): Dictionary containing filter criteria
        
    Returns:
        list: List of SQL condition strings ready for use in WHERE clause
        
    Raises:
        frappe.ValidationError: When from_date is greater than to_date
    """
    
    if not filters:
        return []
        
    conditions = []
    
    # Standard field filters with direct mapping
    field_mappings = {
        "status": "st.status",
        "priority": "st.priority", 
        "division": "st.division",
        "ticket_type": "st.ticket_type",
        "employee_id": "st.employee_id",
        "employee_name": "st.employee_name",
        "branch_name": "st.branch_name",
        "department": "st.dept_name",
        "zone": "st.zone",
        "region": "st.region"
    }
    
    # Process standard filters
    for filter_key, db_field in field_mappings.items():
        if filters.get(filter_key):
            # Escape single quotes to prevent SQL injection
            filter_value = filters[filter_key].replace("'", "''")
            conditions.append(f"{db_field} = '{filter_value}'")
    
    # Handle assignment filter if provided
    if filters.get("assigned_to"):
        assigned_user = filters["assigned_to"].replace("'", "''")
        conditions.append(f"st._assign LIKE '%{assigned_user}%'")
    
    # Process date range filters with validation
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    
    if from_date and to_date:
        # Validate date range
        if from_date > to_date:
            frappe.throw(_("From Date cannot be greater than To Date"))
        conditions.append(f"st.creation BETWEEN '{from_date} 00:00:00' AND '{to_date} 23:59:59'")
    elif from_date:
        conditions.append(f"st.creation >= '{from_date} 00:00:00'")
    elif to_date:
        conditions.append(f"st.creation <= '{to_date} 23:59:59'")
    
    return conditions
