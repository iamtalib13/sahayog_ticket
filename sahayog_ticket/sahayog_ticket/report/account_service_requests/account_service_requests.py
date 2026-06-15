import frappe

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    summary = get_summary()

    return columns, data, None, None, summary


# ----------------------------------------
# Columns
# ----------------------------------------
def get_columns():
    return [
        {"label": "Ticket", "fieldname": "ticket", "fieldtype": "Link", "options": "Sahayog Ticket", "width": 130},
        {"label": "Request Type", "fieldname": "request_type", "fieldtype": "Data", "width": 200},
        {"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 100},
        {"label": "Response Pending", "fieldname": "response_pending", "fieldtype": "Data", "width": 150},
        {"label": "Ticket Type", "fieldname": "ticket_type", "fieldtype": "Data", "width": 150},

        {"label": "Employee ID", "fieldname": "employee_id", "fieldtype": "Link", "options": "Employee", "width": 120},
        {"label": "Employee Name", "fieldname": "employee_name", "fieldtype": "Data", "width": 150},
        {"label": "SOL ID", "fieldname": "sol_id", "fieldtype": "Data", "width": 100},

        {"label": "Branch", "fieldname": "branch", "fieldtype": "Data", "width": 150},
        {"label": "State", "fieldname": "state", "fieldtype": "Data", "width": 120},
        {"label": "Zone", "fieldname": "zone", "fieldtype": "Data", "width": 120},
        {"label": "Region", "fieldname": "region", "fieldtype": "Data", "width": 120},
        {"label": "District", "fieldname": "district", "fieldtype": "Data", "width": 120},

        
    ]


# ----------------------------------------
# Main Data Fetch
# ----------------------------------------
def get_data(filters=None):
    data = []

    if not filters:
        filters = {}

    query_filters = {"ticket_type": "Account Service Request"}
    
    if filters.get("status"):
        query_filters["status"] = filters.get("status")
    
    if filters.get("response_pending"):
        query_filters["response_pending"] = filters.get("response_pending")

    tickets = frappe.get_all(
        "Sahayog Ticket",
        filters=query_filters,
        fields=["name", "employee_id", "ticket_type", "status", "response_pending"]
    )

    for t in tickets:

        # Employee Details
        emp = (frappe.db.get_value(
            "Employee",
            t.employee_id,
            ["employee_name", "sol_id"],
            as_dict=True
        ) if t.employee_id else {}) or {}

        # Branch Details from sol_id
        sol_id = emp.get("sol_id")
        branch = (frappe.db.get_value(
            "Sahayog Branch",
            {"sol_id": sol_id},
            ["branch", "state", "zone", "region", "district"],
            as_dict=True
        ) if sol_id else {}) or {}

        # Child (Ticket Item)
        detail_filters = {"parent": t.name}
        if filters.get("request_type"):
            detail_filters["request_type"] = ["like", f"%{filters.get('request_type')}%"]

        detail = frappe.get_all(
            "Ticket Item",
            filters=detail_filters,
            fields=["request_type"],
            limit=1
        )

        if filters.get("request_type") and not detail:
            continue

        request_type = detail[0].request_type if detail else None

        # Append Row
        data.append({
            "ticket": t.name,
            "status": t.status,
            "response_pending": t.response_pending,
            "ticket_type": t.ticket_type,

            "employee_id": t.employee_id,
            "employee_name": emp.get("employee_name", ""),
            "sol_id": emp.get("sol_id", ""),

            "branch": branch.get("branch", ""),
            "state": branch.get("state", ""),
            "zone": branch.get("zone", ""),
            "region": branch.get("region", ""),
            "district": branch.get("district", ""),

            "request_type": request_type,
        })

    return data


# ----------------------------------------
# Summary (Pending + request_type-wise)
# ----------------------------------------
def get_summary():
    # Fetch pending (open & in-progress) only
    pending_tickets = frappe.get_all(
        "Sahayog Ticket",
        filters={
            "ticket_type": "Account Service Request",
            "status": ["in", ["Open", "In-Progress"]]
        },
        fields=["name"]
    )

    pending_names = [t.name for t in pending_tickets]

    if not pending_names:
        return []

    # Count request types in pending tickets
    result = frappe.db.sql("""
        SELECT request_type, COUNT(*) as total
        FROM `tabTicket Item`
        WHERE parent IN %(parents)s
        GROUP BY request_type
    """, {"parents": pending_names}, as_dict=True)

    summary = []

    for row in result:
        summary.append({
            "label": row.request_type,
            "value": row.total,
            "indicator": "Blue"  # You can also change based on request type
        })

    return summary
