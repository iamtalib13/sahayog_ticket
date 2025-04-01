# Copyright (c) 2025, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe

def execute(filters=None):
    # Define the columns for the report using the provided format
    columns = [
        {
            "fieldname": "ticket_id",
            "label": "Ticket ID",
            "fieldtype": "Link",
            "options": "Sahayog Ticket",
            "width": "120",
        },
        {
            "fieldname": "status",
            "label": "Status",
            "fieldtype": "Data",
            "width": "100",
        },
        {
            "fieldname": "employee_id",
            "label": "Employee ID",
            "fieldtype": "Data",
            "width": "100",
        },
        {
            "fieldname": "employee_name",
            "label": "Employee Name",
            "fieldtype": "Data",
            "width": "150",
        },
        {
            "fieldname": "designation",
            "label": "Designation",
            "fieldtype": "Data",
            "width": "150",
        },
        {
            "fieldname": "emp_department",
            "label": "Department",
            "fieldtype": "Data",
            "width": "150",
        },
        {
            "fieldname": "branch_name",
            "label": "Branch",
            "fieldtype": "Data",
            "width": "150",
        },
        {
            "fieldname": "division",
            "label": "Division",
            "fieldtype": "Data",
            "width": "150",
        },
        {
            "fieldname": "dept_name",
            "label": "Dept Name",
            "fieldtype": "Data",
            "width": "150",
        },
        {
    		"fieldname": "ticket_type",
    		"label": "Ticket Type",
    		"fieldtype": "Link",
    		"options": "Ticket Type", 
    		"width": "150",
		},
        {
            "fieldname": "description",
            "label": "Description",
            "fieldtype": "Data",
            "width": "200",
        },
        {
            "fieldname": "ticket_resolved_user",
            "label": "Resolved By",
            "fieldtype": "Data",
            "width": "150",
        },
        {
            "fieldname": "resolved_remark",
            "label": "Resolved Remark",
            "fieldtype": "Data",
            "width": "200",
        }
    ]
    
    # Base SQL query to fetch the data
    query = """
        SELECT
            name AS "ticket_id",
            status,
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
            resolved_remark
        FROM
            `tabSahayog Ticket`
    """
    
    # Apply filters if provided
    if filters:
        conditions = []
        
        # Add filters to the SQL query dynamically based on the provided filters
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

    # Execute the query and fetch the data
    data = frappe.db.sql(query, as_dict=True)
    
    return columns, data
