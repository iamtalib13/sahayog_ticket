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
            "fieldname": "priority",
            "label": "Priority",
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
            "label": "Employee Department",
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
            "label": "Ticket Department",
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
        },
        {
            "fieldname": "creation",
            "label": "Created On",
            "fieldtype": "Datetime",
            "width": "180",
        }
    ]
    
    # Base SQL query to fetch the data
    query = """
        SELECT
            name AS "ticket_id",
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
            creation
        FROM
            `tabSahayog Ticket`
    """
    
    # Apply filters if provided
    if filters:
        conditions = []
        
        # Add filters dynamically based on the provided values
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
        
        # ✅ Apply date filters
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

        # If conditions are added, append them to the query
        if conditions:
            query += " WHERE " + " AND ".join(conditions)

    # Execute the query and fetch the data
    data = frappe.db.sql(query, as_dict=True)
    
    return columns, data
