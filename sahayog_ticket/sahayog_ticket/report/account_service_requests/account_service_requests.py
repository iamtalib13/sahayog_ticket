import re
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
        {"label": "Creation Date", "fieldname": "creation_date", "fieldtype": "Date", "width": 120},
        {"label": "Creation Time", "fieldname": "creation_time", "fieldtype": "Time", "width": 120},
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
        {"label": "Ticket Cycle", "fieldname": "ticket_cycle", "fieldtype": "Int", "width": 150},
        {"label": "Resolved By", "fieldname": "resolved_by", "fieldtype": "Data", "width": 150},
        {"label": "Resolved Date", "fieldname": "resolved_date", "fieldtype": "Date", "width": 120},
        {"label": "Resolved Time", "fieldname": "resolved_time", "fieldtype": "Time", "width": 120},
        {"label": "Remark", "fieldname": "remark", "fieldtype": "Small Text", "width": 400},
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
        fields=["name", "employee_id", "ticket_type", "status", "response_pending", "creation", "ticket_resolved_user", "resolved_remark", "executive_remark"]
    )

    if not tickets:
        return []

    ticket_names = [t.name for t in tickets]

    # Batch fetch status logs to optimize performance
    status_logs = frappe.get_all(
        "Ticket Status Log",
        filters={"parent": ["in", ticket_names]},
        fields=["parent", "from_status", "to_status", "status_change_by", "status_change_on", "status_remark"],
        order_by="status_change_on asc"
    )

    # Organize logs by ticket name
    logs_map = {}
    for log in status_logs:
        if log.parent not in logs_map:
            logs_map[log.parent] = []
        logs_map[log.parent].append(log)

    # Batch fetch comments for all tickets
    all_comments = frappe.get_all(
        "Comment",
        filters={
            "reference_doctype": "Sahayog Ticket",
            "reference_name": ["in", ticket_names],
            "comment_type": ["in", ["Comment", "Attachment"]]
        },
        fields=["reference_name", "content", "owner", "creation"],
        order_by="creation asc"
    )

    # Organize comments by ticket name
    comments_map = {}
    for c in all_comments:
        if c.reference_name not in comments_map:
            comments_map[c.reference_name] = []
        comments_map[c.reference_name].append(c)

    # Batch fetch Employee details
    employee_ids = list(set(t.employee_id for t in tickets if t.employee_id))
    employees = frappe.get_all(
        "Employee",
        filters={"employee_number": ["in", employee_ids]} if employee_ids else {},
        fields=["employee_number", "employee_name", "sol_id"]
    ) if employee_ids else []
    emp_map = {e.employee_number: e for e in employees}

    # Batch fetch Sahayog Branch details
    sol_ids = list(set(emp_map[eid].get("sol_id") for eid in employee_ids if emp_map.get(eid, {}).get("sol_id")))
    branches = frappe.get_all(
        "Sahayog Branch",
        filters={"sol_id": ["in", sol_ids]} if sol_ids else {},
        fields=["sol_id", "branch", "state", "zone", "region", "district"]
    ) if sol_ids else []
    branch_map = {b.sol_id: b for b in branches}

    # Batch fetch Ticket Items
    detail_filters = {"parent": ["in", ticket_names]}
    if filters.get("request_type"):
        detail_filters["request_type"] = filters.get("request_type")
    all_details = frappe.get_all(
        "Ticket Item",
        filters=detail_filters,
        fields=["parent", "request_type"]
    )
    detail_map = {}
    for d in all_details:
        detail_map.setdefault(d.parent, []).append(d)

    for t in tickets:

        # Employee Details (pre-fetched)
        emp = emp_map.get(t.employee_id, {})

        # Branch Details from sol_id (pre-fetched)
        sol_id = emp.get("sol_id")
        branch = branch_map.get(sol_id, {}) if sol_id else {}

        # Child (Ticket Item) (pre-fetched)
        request_type = None
        ticket_details = detail_map.get(t.name, [])
        if filters.get("request_type"):
            ticket_details = [d for d in ticket_details if d.request_type == filters.get("request_type")]
            if not ticket_details:
                continue
        if ticket_details:
            request_type = ticket_details[0].request_type

        # Process logs for the ticket
        t_logs = logs_map.get(t.name, [])
        
        # Use first log entry for creation if available, else doc creation
        creation_on = t_logs[0].status_change_on if t_logs else t.creation
        creation_date = getdate(creation_on)
        creation_time = get_time(creation_on)

        resolved_date = None
        resolved_time = None
        resolved_on = None

        # Find the latest "Resolved" log entry for date/time
        for log in reversed(t_logs):
            if log.to_status == "Resolved":
                resolved_date = getdate(log.status_change_on)
                resolved_time = get_time(log.status_change_on)
                resolved_on = log.status_change_on
                break

        # Ticket Cycle (Now showing count of log entries)
        ticket_cycle = len(t_logs)

        # Build remark: executive_remark + resolved_remark + comments
        remarks = []
        
        # Add executive remark
        if t.get("executive_remark"):
            exec_remark = str(t.executive_remark).strip()
            if exec_remark:
                remarks.append(f"Executive Remark: {exec_remark}")
        
        # Add resolved remark
        if t.get("resolved_remark"):
            resolved_rem = str(t.resolved_remark).strip()
            if resolved_rem:
                remarks.append(f"Resolved Remark: {resolved_rem}")
        
        # Add all comments
        for c in comments_map.get(t.name, []):
            content = str(c.content or "").strip()
            # Remove HTML tags if present
            if content:
                # Simple HTML tag removal
                content_clean = re.sub(r'<[^>]+>', '', content).strip()
                if content_clean:
                    remarks.append(f"{c.owner}: {content_clean}")
        
        # Join all remarks with newline for full display
        combined_remark = "\n".join(remarks) if remarks else ""

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
            "resolved_by": t.get("ticket_resolved_user"),
            "remark": combined_remark
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
