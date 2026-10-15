"""Account Service Report — Page API
Serves data for the asr-report Frappe Page.
Audience: System Manager, Employee (same as existing Script Report).
"""

import frappe
from frappe.utils import getdate, get_time

TICKET_TYPE = "Account Service Request"


def _strip_html(html):
    """Plain text from comment HTML for the report table."""
    import re
    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", text).strip()

REQUEST_TYPES = [
    "Activation of Dormant account",
    "Change of Address",
    "DOB Updation",
    "Name Change",
    "Nomination Addition/ Deletion/ Modification",
    "SMS Alert Registration",
    "Update Contact Number",
    "Update Email Address",
    "Update KYC (Adhaar/Voter/Passport/etc)",
    "Update PAN NO",
    "Update Signature",
    "Account Transfer",
]


@frappe.whitelist()
def get_report_data(filters=None, page_no=1, page_size=20):
    """Return paginated ticket rows + summary counts."""
    if isinstance(filters, str):
        import json
        filters = json.loads(filters)
    filters = filters or {}
    page_no   = int(page_no)
    page_size = int(page_size)
    offset    = (page_no - 1) * page_size

    conditions, params = _build_conditions(filters)
    where_clause = "WHERE " + " AND ".join(conditions)

    # Total count
    count_row = frappe.db.sql(
        f"SELECT COUNT(*) as cnt FROM `tabSahayog Ticket` st {where_clause}",
        params, as_dict=True
    )
    total = count_row[0].cnt if count_row else 0

    # Main query
    query = f"""
        SELECT
            st.name                 AS ticket,
            st.status,
            st.dept_name,
            st.response_pending,
            st.ticket_type,
            st.employee_id,
            st.employee_name,
            st.sol_id,
            st.branch,
            st.state,
            st.zone,
            st.region,
            st.district,
            st.ticket_resolved_user AS resolved_by,
            st.ticket_resolved_on,
            st.resolved_remark,
            st.executive_remark,
            st.creation,
            st.modified,
            (
                SELECT ti.request_type FROM `tabTicket Item` ti
                WHERE ti.parent = st.name LIMIT 1
            ) AS request_type,
            (
                SELECT COUNT(*) FROM `tabTicket Status Log` tsl
                WHERE tsl.parent = st.name
            ) AS ticket_cycle,
            (
                SELECT COUNT(*) FROM tabComment c
                WHERE c.reference_doctype = 'Sahayog Ticket'
                  AND c.reference_name = st.name
                  AND c.comment_type = 'Comment'
            ) AS comments_count,
            (
                SELECT c.content FROM tabComment c
                WHERE c.reference_doctype = 'Sahayog Ticket'
                  AND c.reference_name = st.name
                  AND c.comment_type = 'Comment'
                ORDER BY c.creation DESC LIMIT 1
            ) AS last_comment,
            (
                SELECT c.comment_by FROM tabComment c
                WHERE c.reference_doctype = 'Sahayog Ticket'
                  AND c.reference_name = st.name
                  AND c.comment_type = 'Comment'
                ORDER BY c.creation DESC LIMIT 1
            ) AS last_comment_by,
            DATE(st.ticket_resolved_on) AS resolved_date,
            TIME(st.ticket_resolved_on) AS resolved_time
        FROM `tabSahayog Ticket` st
        {where_clause}
        ORDER BY st.modified DESC
        LIMIT %s OFFSET %s
    """
    rows = frappe.db.sql(query, params + [page_size, offset], as_dict=True)

    data = []
    for t in rows:
        data.append({
            "ticket":           t.ticket,
            "creation_date":    str(getdate(t.creation)) if t.creation else "",
            "creation_time":    str(get_time(t.creation)) if t.creation else "",
            "modified":         str(t.modified) if t.modified else "",
            "status":           t.status or "",
            "dept_name":        t.dept_name or "",
            "response_pending": t.response_pending or "",
            "ticket_type":      t.ticket_type or "",
            "request_type":     t.request_type or "",
            "employee_id":      t.employee_id or "",
            "employee_name":    t.employee_name or "",
            "sol_id":           t.sol_id or "",
            "branch":           t.branch or "",
            "state":            t.state or "",
            "zone":             t.zone or "",
            "region":           t.region or "",
            "district":         t.district or "",
            "ticket_cycle":     t.ticket_cycle or 0,
            "resolved_by":      t.resolved_by or "",
            "resolved_date":    str(t.resolved_date) if t.resolved_date else "",
            "resolved_time":    str(t.resolved_time) if t.resolved_time else "",
            "remark":           (t.get("resolved_remark") or "").strip(),
            "comments_count":   t.comments_count or 0,
            "last_comment":     _strip_html(t.last_comment or ""),
            "last_comment_by":  t.last_comment_by or "",
        })

    # Summary counts by status (ignores the status filter so the
    # All/Pending/Completed tab counts stay global).
    sum_conditions, sum_params = _build_conditions(filters, exclude_status=True)
    summary = _get_summary(sum_conditions, sum_params)

    return {
        "data":     data,
        "total":    total,
        "page_no":  page_no,
        "page_size":page_size,
        "summary":  summary,
    }


def _build_conditions(filters, exclude_status=False):
    conditions = ["st.ticket_type = 'Account Service Request'"]
    params = []

    allowed_statuses = ("Open", "In-Progress", "Resolved", "Closed")
    if not exclude_status and filters.get("statuses"):
        vals = [s for s in filters["statuses"] if s in allowed_statuses]
        if vals:
            conditions.append("st.status IN ({})".format(", ".join(["%s"] * len(vals))))
            params.extend(vals)

    if not exclude_status and filters.get("status") and filters["status"] in allowed_statuses:
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
                WHERE ti.parent = st.name AND ti.request_type = %s
            )
        """)
        params.append(filters["request_type"])

    if filters.get("from_date"):
        conditions.append("DATE(st.creation) >= %s")
        params.append(filters["from_date"])

    if filters.get("to_date"):
        conditions.append("DATE(st.creation) <= %s")
        params.append(filters["to_date"])

    return conditions, params


def _get_summary(conditions, params):
    where = "WHERE " + " AND ".join(conditions)
    rows = frappe.db.sql(
        f"""SELECT st.status, COUNT(*) as cnt
            FROM `tabSahayog Ticket` st
            {where}
            GROUP BY st.status""",
        params, as_dict=True
    )
    summary = {"Open": 0, "In-Progress": 0, "Resolved": 0, "Closed": 0, "Total": 0}
    for r in rows:
        key = r.status
        if key in summary:
            summary[key] = r.cnt
        summary["Total"] += r.cnt
    return summary


@frappe.whitelist()
def get_ticket_comments(ticket):
    """All user comments of one ticket for the report popup."""
    rows = frappe.db.sql(
        """SELECT comment_by, content, creation FROM tabComment
           WHERE reference_doctype = 'Sahayog Ticket'
             AND reference_name = %s
             AND comment_type = 'Comment'
           ORDER BY creation DESC""",
        (ticket,), as_dict=True,
    )
    return [{
        "by":   r.comment_by or "",
        "text": _strip_html(r.content or ""),
        "on":   str(r.creation) if r.creation else "",
    } for r in rows]


@frappe.whitelist()
def get_filter_options():
    """Return dropdown options for Request Type and SOL ID."""
    return {
        "request_types": REQUEST_TYPES,
        "sol_ids": frappe.get_all("Sahayog Branch", fields=["sol_id", "branch"],
                                  order_by="sol_id asc", limit=500),
    }


@frappe.whitelist()
def add_ticket_comment(ticket, text):
    """Add a comment to a Sahayog Ticket from the ASR report."""
    text = (text or "").strip()
    if not text:
        frappe.throw("Comment cannot be empty.")

    frappe.get_doc({
        "doctype":            "Comment",
        "comment_type":       "Comment",
        "reference_doctype":  "Sahayog Ticket",
        "reference_name":     ticket,
        "content":            frappe.utils.escape_html(text),
        "comment_by":         frappe.session.user,
    }).insert(ignore_permissions=True)

    return {"status": "ok"}
