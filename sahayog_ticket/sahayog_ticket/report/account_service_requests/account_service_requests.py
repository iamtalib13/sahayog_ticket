import frappe
from frappe.utils import getdate, get_time, time_diff_in_hours, now_datetime

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

        # New Columns added as per request
        {"label": "Creation Date", "fieldname": "creation_date", "fieldtype": "Date", "width": 120},
        {"label": "Creation Time", "fieldname": "creation_time", "fieldtype": "Time", "width": 120},
        {"label": "Ticket Cycle", "fieldname": "ticket_cycle", "fieldtype": "Data", "width": 150},
        {"label": "Resolved Date", "fieldname": "resolved_date", "fieldtype": "Date", "width": 120},
        {"label": "Resolved Time", "fieldname": "resolved_time", "fieldtype": "Time", "width": 120},
        {"label": "Resolved By", "fieldname": "resolved_by", "fieldtype": "Data", "width": 150},
        {"label": "Remark", "fieldname": "remark", "fieldtype": "Small Text", "width": 200},
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
    
    if filters.get("sol_id"):
        query_filters["sol_id"] = filters.get("sol_id")

    tickets = frappe.get_all(
        "Sahayog Ticket",
        filters=query_filters,
        fields=["name", "employee_id", "ticket_type", "status", "response_pending", "creation"]
    )

    if not tickets:
        return []

    ticket_names = [t.name for t in tickets]

    # Batch fetch status logs to optimize performance
    status_logs = frappe.get_all(
        "Ticket Status Log",
        filters={"parent": ["in", ticket_names]},
        fields=["parent", "to_status", "status_change_by", "status_change_on", "status_remark"],
        order_by="status_change_on asc"
    )

    # Organize logs by ticket name
    logs_map = {}
    for log in status_logs:
        if log.parent not in logs_map:
            logs_map[log.parent] = []
        logs_map[log.parent].append(log)

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
            detail_filters["request_type"] = filters.get("request_type")

        detail = frappe.get_all(
            "Ticket Item",
            filters=detail_filters,
            fields=["request_type"],
            limit=1
        )

        if filters.get("request_type") and not detail:
            continue

        request_type = detail[0].request_type if detail else None

        # Process logs for the ticket
        t_logs = logs_map.get(t.name, [])
        
        # Use first log entry for creation if available, else doc creation
        creation_on = t_logs[0].status_change_on if t_logs else t.creation
        creation_date = getdate(creation_on)
        creation_time = get_time(creation_on)

        resolved_date = None
        resolved_time = None
        resolved_by = None
        remark = None
        resolved_on = None

        # Find the latest "Resolved" log entry
        for log in reversed(t_logs):
            if log.to_status == "Resolved":
                resolved_date = getdate(log.status_change_on)
                resolved_time = get_time(log.status_change_on)
                resolved_by = log.status_change_by
                remark = log.status_remark
                resolved_on = log.status_change_on
                break

        # Calculate Ticket Cycle (Duration)
        # From creation to resolution, or until now if not resolved
        end_time = resolved_on if resolved_on else now_datetime()
        diff_hours = time_diff_in_hours(end_time, creation_on)
        days = int(diff_hours // 24)
        hours = int(diff_hours % 24)
        ticket_cycle = f"{days} Days {hours} Hours"

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
            
            # New field values
            "creation_date": creation_date,
            "creation_time": creation_time,
            "ticket_cycle": ticket_cycle,
            "resolved_date": resolved_date,
            "resolved_time": resolved_time,
            "resolved_by": resolved_by,
            "remark": remark
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
    """, {"parents": tuple(pending_names)}, as_dict=True)

    summary = []

    for row in result:
        summary.append({
            "label": row.request_type,
            "value": row.total,
            "indicator": "Blue"  # You can also change based on request type
        })

    return summary
