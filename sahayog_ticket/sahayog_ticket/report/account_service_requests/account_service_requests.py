import frappe
from frappe.utils import getdate, get_time


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
        {"label": "Creation Date",    "fieldname": "creation_date",    "fieldtype": "Date",       "width": 120},
        {"label": "Creation Time",    "fieldname": "creation_time",    "fieldtype": "Time",       "width": 120},
        {"label": "Ticket",           "fieldname": "ticket",           "fieldtype": "Link",       "options": "Sahayog Ticket", "width": 130},
        {"label": "Request Type",     "fieldname": "request_type",     "fieldtype": "Data",       "width": 200},
        {"label": "Status",           "fieldname": "status",           "fieldtype": "Data",       "width": 100},
        {"label": "Response Pending", "fieldname": "response_pending", "fieldtype": "Data",       "width": 150},
        {"label": "Ticket Type",      "fieldname": "ticket_type",      "fieldtype": "Data",       "width": 150},
        {"label": "Employee ID",      "fieldname": "employee_id",      "fieldtype": "Data",       "width": 120},
        {"label": "Employee Name",    "fieldname": "employee_name",    "fieldtype": "Data",       "width": 150},
        {"label": "SOL ID",           "fieldname": "sol_id",           "fieldtype": "Data",       "width": 100},
        {"label": "Branch",           "fieldname": "branch",           "fieldtype": "Data",       "width": 150},
        {"label": "State",            "fieldname": "state",            "fieldtype": "Data",       "width": 120},
        {"label": "Zone",             "fieldname": "zone",             "fieldtype": "Data",       "width": 120},
        {"label": "Region",           "fieldname": "region",           "fieldtype": "Data",       "width": 120},
        {"label": "District",         "fieldname": "district",         "fieldtype": "Data",       "width": 120},
        {"label": "Ticket Cycle",     "fieldname": "ticket_cycle",     "fieldtype": "Int",        "width": 120},
        {"label": "Resolved By",      "fieldname": "resolved_by",      "fieldtype": "Data",       "width": 150},
        {"label": "Resolved Date",    "fieldname": "resolved_date",    "fieldtype": "Date",       "width": 120},
        {"label": "Resolved Time",    "fieldname": "resolved_time",    "fieldtype": "Time",       "width": 120},
        {"label": "Remark",           "fieldname": "remark",           "fieldtype": "Small Text", "width": 400},
    ]


# ----------------------------------------
# Main Data Fetch — Only Sahayog Ticket & its child tables
# ----------------------------------------
def get_data(filters=None):
    if not filters:
        filters = {}

    # ── Build WHERE conditions ──────────────────────────────────────────────
    conditions = ["st.ticket_type = 'Account Service Request'"]
    params = []

    if filters.get("status"):
        conditions.append("st.status = %s")
        params.append(filters["status"])

    if filters.get("response_pending"):
        conditions.append("st.response_pending = %s")
        params.append(filters["response_pending"])

    if filters.get("sol_id"):
        conditions.append("st.sol_id = %s")
        params.append(filters["sol_id"])

    if filters.get("request_type"):
        conditions.append("""
            EXISTS (
                SELECT 1 FROM `tabTicket Item` ti
                WHERE ti.parent = st.name
                AND ti.request_type = %s
            )
        """)
        params.append(filters["request_type"])

    where_clause = "WHERE " + " AND ".join(conditions)

    # ── Single query on Sahayog Ticket only ───────────────────────────────
    query = f"""
        SELECT
            st.name                 AS ticket,
            st.status,
            st.response_pending,
            st.ticket_type,
            st.employee_id,
            st.employee_name,
            st.sol_id,
            st.branch               AS branch,
            st.state,
            st.zone,
            st.region,
            st.district,
            st.ticket_resolved_user AS resolved_by,
            st.ticket_resolved_on,
            st.resolved_remark,
            st.executive_remark,
            st.creation,

            -- request_type from child table request_detail (Ticket Item)
            (
                SELECT ti.request_type
                FROM `tabTicket Item` ti
                WHERE ti.parent = st.name
                LIMIT 1
            ) AS request_type,

            -- ticket_cycle: count of status log entries (child table status_log)
            (
                SELECT COUNT(*)
                FROM `tabTicket Status Log` tsl
                WHERE tsl.parent = st.name
            ) AS ticket_cycle,

            -- resolved_date and resolved_time from existing ticket_resolved_on field
            DATE(st.ticket_resolved_on) AS resolved_date,
            TIME(st.ticket_resolved_on) AS resolved_time

        FROM `tabSahayog Ticket` st
        {where_clause}
        ORDER BY st.creation DESC
    """

    rows = frappe.db.sql(query, params, as_dict=True)

    data = []
    for t in rows:
        # Build remark from fields already on Sahayog Ticket (no Comment doctype)
        remarks = []
        if t.get("executive_remark"):
            exec_rem = str(t.executive_remark).strip()
            if exec_rem:
                remarks.append(f"Executive Remark: {exec_rem}")
        if t.get("resolved_remark"):
            res_rem = str(t.resolved_remark).strip()
            if res_rem:
                remarks.append(f"Resolved Remark: {res_rem}")
        combined_remark = "\n".join(remarks)

        data.append({
            "ticket":           t.ticket,
            "status":           t.status,
            "response_pending": t.response_pending,
            "ticket_type":      t.ticket_type,
            "employee_id":      t.employee_id,
            "employee_name":    t.employee_name or "",
            "sol_id":           t.sol_id or "",
            "branch":           t.branch or "",
            "state":            t.state or "",
            "zone":             t.zone or "",
            "region":           t.region or "",
            "district":         t.district or "",
            "request_type":     t.request_type or "",
            "creation_date":    getdate(t.creation),
            "creation_time":    get_time(t.creation),
            "ticket_cycle":     t.ticket_cycle or 0,
            "resolved_by":      t.resolved_by or "",
            "resolved_date":    t.resolved_date,
            "resolved_time":    t.resolved_time,
            "remark":           combined_remark,
        })

    return data


# ----------------------------------------
# Summary — only Sahayog Ticket child table (Ticket Item)
# ----------------------------------------
def get_summary():
    result = frappe.db.sql("""
        SELECT ti.request_type, COUNT(*) AS total
        FROM `tabTicket Item` ti
        INNER JOIN `tabSahayog Ticket` st ON ti.parent = st.name
        WHERE st.ticket_type = 'Account Service Request'
          AND st.status IN ('Open', 'In-Progress')
        GROUP BY ti.request_type
    """, as_dict=True)

    return [
        {"label": row.request_type, "value": row.total, "indicator": "Blue"}
        for row in result
    ]
