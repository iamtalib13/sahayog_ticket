"""Account Service Report — Page API
Serves data for the asr-report Frappe Page.
Audience: System Manager, Employee (same as existing Script Report).
"""

import frappe
from frappe.utils import getdate, get_time

TICKET_TYPE = "Account Service Request"

# Roles that identify the Operations side of a ticket thread.
OPERATIONS_ROLES = frozenset(("Operations Support Executive",
                              "Operations Support Manager",
                              "CPC Loan User"))

# Request types temporarily disabled in the UI. They stay in the doctype
# options so existing records keep validating, but are hidden from pickers.
DISABLED_REQUEST_TYPES = ("Account Transfer",)


def _handoff_counts(ticket_names):
    """Branch <-> Operations handoff count per ticket (report "Cycle").

    A handoff does not change `status` (it stays In-Progress); only
    `response_pending` flips between Pending Branch / Pending Operations.
    So the count comes from Frappe's Version history instead of status_log.
    The initial "" -> "Pending Operations" default is not a handoff.
    """
    counts = {}
    names = [n for n in (ticket_names or []) if n]
    for start in range(0, len(names), 500):
        chunk = names[start:start + 500]
        placeholders = ", ".join(["%s"] * len(chunk))
        rows = frappe.db.sql(
            f"""
            SELECT v.docname, COUNT(*) AS handoffs
            FROM `tabVersion` v
            WHERE v.ref_doctype = 'Sahayog Ticket'
              AND v.docname IN ({placeholders})
              AND v.data LIKE %s
              AND EXISTS (
                    SELECT 1 FROM JSON_TABLE(
                        v.data, '$.changed[*]' COLUMNS (
                            fname  VARCHAR(64) PATH '$[0]',
                            oldval VARCHAR(64) PATH '$[1]',
                            newval VARCHAR(64) PATH '$[2]'
                        )
                    ) jt
                    WHERE jt.fname = 'response_pending'
                      AND jt.oldval IN ('Pending Branch', 'Pending Operations')
                      AND jt.newval IN ('Pending Branch', 'Pending Operations')
              )
            GROUP BY v.docname
            """,
            chunk + ['%"response_pending"%'],
            as_dict=True,
        )
        for r in rows:
            counts[r.docname] = r.handoffs
    return counts


def _strip_html(html):
    """Plain text from comment HTML for the report table."""
    import re
    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", text).strip()


# Password-field parity: comments mentioning secrets are visible only to
# password viewers (assigned_to / show_password_to_employee), like the
# password field itself. Only on CBS tickets (the password field's scope).
SENSITIVE_KEYWORDS = ("password", "passwd", "pwd", "otp", "one-time",
                      "one time", "credential")


def _is_sensitive(text):
    t = _strip_html(text or "").lower()
    return any(k in t for k in SENSITIVE_KEYWORDS)


def _can_view_ticket_password(ticket):
    """Mirror SahayogTicket.can_view_password without loading the full doc."""
    assigned = frappe.db.get_value("Sahayog Ticket", ticket, "assigned_to")
    if assigned and frappe.session.user == assigned:
        return True
    emp = frappe.db.get_value("Sahayog Ticket", ticket, "show_password_to_employee")
    if emp:
        emp_user = frappe.db.get_value("Employee", emp, "user_id")
        if emp_user and frappe.session.user == emp_user:
            return True
    return False


def _ticket_updates(ticket):
    """Child-table mirror, grouped exactly like its sections."""
    sections = [
        ("", [("request_type", "Request Type"), ("cif", "Customer ID"),
              ("attatchment", "Attatchment")]),
        ("Request Type", []),
        ("Account Holder Details", [
            ("account_type", "Account Type"), ("customer_name", "Customer Name"),
            ("account_number", "Account Number"), ("contact_number", "Contact Number")]),
        ("New Information", [
            ("new_address", "New Address"), ("new_contact_number", "New Contact Number"),
            ("new_kyc_no", "New KYC No"), ("new_pan_no", "New PAN No"),
            ("email", "Email"), ("new_email", "New Email"),
            ("new_name", "Enter New Name"), ("nomination_opration", "Nomination Opration"),
            ("existing_branch", "Existing Branch"), ("new_branch", "New Branch"),
            ("updated_dob", "Updated DOB")]),
    ]
    keys = [k for _, pairs in sections for k, _ in pairs]
    items = frappe.get_all("Ticket Item", {"parent": ticket},
                           ["name", "request_status"] + keys, order_by="idx")
    out = []
    for it in items:
        groups = []
        for sec, pairs in sections:
            lines = []
            for key, label in pairs:
                v = it.get(key)
                if v is None:
                    continue
                v = str(v).strip()
                if v and not (sec == "" and key == "request_type"):
                    lines.append({"label": label, "value": v})
            if lines:
                groups.append({"section": sec, "lines": lines})
        if groups:
            head = " / ".join(x for x in (it.request_type, it.account_number) if x) or "Item"
            out.append({
                "title": head,
                "request_status": (it.request_status or "").strip(),
                "groups": groups,
            })
    return out


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
            (
                SELECT e.user_id FROM tabEmployee e
                WHERE e.name = st.show_password_to_employee LIMIT 1
            ) AS spw_user,
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
            st.assigned_to,
            st.assigned_to_name,
            st.ticket_resolved_user AS resolved_by,
            st.ticket_resolved_on,
            st.resolved_remark,
            st.executive_remark,
            st.creation,
            st.modified,
            (
                SELECT GROUP_CONCAT(DISTINCT ti.request_type
                                    ORDER BY ti.request_type SEPARATOR ', ')
                FROM `tabTicket Item` ti
                WHERE ti.parent = st.name
                  AND IFNULL(ti.request_type, '') != ''
            ) AS request_type,
            (
                SELECT ti.account_number FROM `tabTicket Item` ti
                WHERE ti.parent = st.name LIMIT 1
            ) AS account_number,
            st.executive_remark,
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

    handoffs = _handoff_counts([t.ticket for t in rows])

    data = []
    for t in rows:
        d = {
            "ticket":           t.ticket,
            "creation_date":    str(getdate(t.creation)) if t.creation else "",
            "creation_time":    str(get_time(t.creation)) if t.creation else "",
            "modified":         str(t.modified) if t.modified else "",
            "status":           t.status or "",
            "dept_name":        t.dept_name or "",
            "spw_user":         t.spw_user or "",
            "response_pending": t.response_pending or "",
            "ticket_type":      t.ticket_type or "",
            "request_type":     t.request_type or "",
            "account_number":   t.account_number or "",
            "executive_remark": (t.get("executive_remark") or "").strip(),
            "employee_id":      t.employee_id or "",
            "employee_name":    t.employee_name or "",
            "sol_id":           t.sol_id or "",
            "branch":           t.branch or "",
            "assigned_to":      t.assigned_to or "",
            "assigned_to_name": t.assigned_to_name or "",
            "state":            t.state or "",
            "zone":             t.zone or "",
            "region":           t.region or "",
            "district":         t.district or "",
            "ticket_cycle":     handoffs.get(t.ticket, 0),
            "resolved_by":      t.resolved_by or "",
            "resolved_date":    str(t.resolved_date) if t.resolved_date else "",
            "resolved_time":    str(t.resolved_time) if t.resolved_time else "",
            "remark":           (t.get("resolved_remark") or "").strip(),
            "comments_count":   t.comments_count or 0,
            "last_comment":     _strip_html(t.last_comment or ""),
            "last_comment_by":  t.last_comment_by or "",
            "updates":          _ticket_updates(t.ticket),
        }
        # Password parity on CBS tickets: mask secret-mentioning preview.
        if (d.get("dept_name") or "") == "CBS":
            viewers = {x for x in (t.assigned_to, t.spw_user) if x}
            if _is_sensitive(d["last_comment"]) and frappe.session.user not in viewers:
                d["last_comment"] = ""
                d["last_comment_by"] = ""
        data.append(d)

    # Summary counts by status (ignores the status AND response_pending
    # filters so the All/Pending/Completed tab counts stay static when the
    # user clicks Open / Pending Operations / Pending Branch sub-badges).
    sum_filters = dict(filters or {})
    sum_filters.pop("response_pending", None)
    sum_conditions, sum_params = _build_conditions(sum_filters, exclude_status=True)
    summary = _get_summary(sum_conditions, sum_params)

    # Pending-tab sub-badge counts: response_pending among Open+In-Progress
    # (ignores status/response_pending filters so badges stay global).
    rp_filters = dict(filters or {})
    rp_filters.pop("response_pending", None)
    rp_conditions, rp_params = _build_conditions(rp_filters, exclude_status=True)
    rp_conditions.append("st.status IN ('Open','In-Progress')")
    rp_rows = frappe.db.sql(
        f"""SELECT st.response_pending, COUNT(*) as cnt
            FROM `tabSahayog Ticket` st
            WHERE {" AND ".join(rp_conditions)}
            GROUP BY st.response_pending""",
        rp_params, as_dict=True)
    for r in rp_rows:
        key = r.response_pending or ""
        if key in ("Pending Operations", "Pending Branch"):
            summary[key] = summary.get(key, 0) + r.cnt
    summary.setdefault("Pending Operations", 0)
    summary.setdefault("Pending Branch", 0)

    # Last CPC-side comment for the CSV export (any ticket status).
    _attach_last_cpc_comment(data)

    return {
        "data":     data,
        "total":    total,
        "page_no":  page_no,
        "page_size":page_size,
        "summary":  summary,
    }


def _ose_users():
    """Operations-side users (role "Operations Support Executive").

    Returns (ids, names): the user ids and the full names, both lower-cased,
    so a comment can be matched whether it stores the id
    ("4046@sahayog.com") or the display name ("TUSHAR UMBARKAR").
    Administrator / Guest are excluded - they are not operations users
    (same rule as the assign dropdowns).
    """
    rows = frappe.db.sql(
        """SELECT u.name AS name, u.full_name AS full_name
           FROM `tabHas Role` r
           INNER JOIN tabUser u ON u.name = r.parent
           WHERE r.role = %s
             AND r.parenttype = 'User'
             AND u.enabled = 1
             AND u.name NOT IN ('Guest', 'Administrator')""",
        ("Operations Support Executive",), as_dict=True)
    ids, names = set(), set()
    for r in rows:
        if r.name:
            ids.add(r.name.strip().lower())
        if r.full_name:
            names.add(r.full_name.strip().lower())
    return ids, names


def _attach_last_cpc_comment(data):
    """Attach the LAST comment for the CSV as last_cpc_by / last_cpc_comment.

    Rule:
      1. the ticket's ASSIGNED user (assigned_to, any ticket status) - their
         last comment wins;
      2. if the assigned user never commented (or the ticket is not
         assigned), fall back to the LAST comment made by a user holding
         the "Operations Support Executive" role;
      3. if neither exists the cells stay empty.

    Comment history is NOT included - only the single last comment.
    """
    import html as _html

    for d in data:
        d["last_cpc_by"] = ""
        d["last_cpc_comment"] = ""
        d["last_ose_by"] = ""
        d["last_ose_comment"] = ""
    if not data:
        return
    ose_ids, ose_names = _ose_users()
    names = [d["ticket"] for d in data]
    ph_t = ", ".join(["%s"] * len(names))
    crows = frappe.db.sql(
        f"""SELECT c.reference_name, c.comment_by, c.owner, c.content,
                   u.full_name AS owner_full_name
            FROM tabComment c
            LEFT JOIN tabUser u ON u.name = c.owner
            WHERE c.reference_doctype = 'Sahayog Ticket'
              AND c.reference_name IN ({ph_t})
              AND c.comment_type = 'Comment'
            ORDER BY c.creation ASC""",
        tuple(names), as_dict=True)
    by_ticket = {x["ticket"]: x for x in data}
    for c in crows:
        d = by_ticket.get(c.reference_name)
        if not d:
            continue
        # comment_by may hold a display name (e.g. "TUSHAR UMBARKAR") or an
        # uppercased id ("ADMINISTRATOR") — owner holds the real user id.
        owner = (c.owner or "").strip()
        by = (c.comment_by or "").strip()
        # Show the full name of the author in the report.
        display = (c.owner_full_name or "").strip() or by or owner
        text = _html.unescape(_strip_html(c.content or ""))

        # 1. Assigned user's comment.
        assigned = (d.get("assigned_to") or "").strip().lower()
        if assigned and (owner.lower() == assigned or by.lower() == assigned):
            # Oldest-first order: each match overwrites → last wins.
            d["last_cpc_by"] = display
            d["last_cpc_comment"] = text
            continue

        # 2. Fallback: comment by an Operations Support Executive.
        if (owner.lower() in ose_ids or by.lower() in ose_ids
                or by.lower() in ose_names):
            d["last_ose_by"] = display
            d["last_ose_comment"] = text

    # Use the OSE comment only when the assigned user has none.
    for d in data:
        if not d["last_cpc_by"] and d["last_ose_comment"]:
            d["last_cpc_by"] = d["last_ose_by"]
            d["last_cpc_comment"] = d["last_ose_comment"]
        d.pop("last_ose_by", None)
        d.pop("last_ose_comment", None)


# ── CSV export (sync for small data, background job for large data) ──
SYNC_EXPORT_LIMIT = 2000  # rows handled synchronously; more → frappe.enqueue

CSV_HEADERS = [
    "Last Modified", "Ticket", "Creation Date", "Creation Time",
    "Request Type", "SOL ID", "Branch", "Status", "Response Pending",
    "Ticket Cycle", "Employee ID", "Employee Name",
    "State", "Zone", "Region", "District",
    "Resolved By", "Resolved Date", "Resolved Time", "Resolver Remark",
    "Last Comment By", "Last Comment",
]


def _fmt_date(d):
    d = str(d or "")
    if not d:
        return ""
    return "-".join(d.split("-")[::-1])


def _fmt_time(t):
    t = str(t or "")
    if not t:
        return ""
    parts = t[:5].split(":")
    h = int(parts[0])
    mi = parts[1]
    ampm = "PM" if h >= 12 else "AM"
    h = h % 12 or 12
    return "%02d:%s %s" % (h, mi, ampm)


def _fmt_modified(m):
    m = str(m or "")
    if not m:
        return ""
    date_part, _, time_part = m.partition(" ")
    return (_fmt_date(date_part) + " " + _fmt_time(time_part)).strip()


def _export_request_types_by_ticket(tickets):
    """Request types per ticket from Request Detail (Ticket Item), in row order.
    Used to expand CSV export so each request detail becomes its own row."""
    if not tickets:
        return {}
    req_map = {}
    for start in range(0, len(tickets), 500):
        chunk = tickets[start:start + 500]
        rows = frappe.get_all(
            "Ticket Item",
            filters={"parent": ["in", chunk]},
            fields=["parent", "request_type"],
            order_by="idx asc",
        )
        for r in rows:
            req_map.setdefault(r.parent, []).append((r.request_type or "").strip())
    return req_map


def _build_export_csv(data):
    import io

    tickets = [row.get("ticket") for row in data if row.get("ticket")]
    req_map = _export_request_types_by_ticket(tickets)

    buf = io.StringIO()
    buf.write(",".join(CSV_HEADERS) + "\n")
    for row in data:
        request_types = req_map.get(row.get("ticket")) or [row.get("request_type") or ""]
        for request_type in request_types:
            vals = [
                _fmt_modified(row.get("modified")),
                row.get("ticket"),
                _fmt_date(row.get("creation_date")),
                _fmt_time(row.get("creation_time")),
                request_type,
                row.get("sol_id"),
                row.get("branch"),
                row.get("status"),
                row.get("response_pending"),
                row.get("ticket_cycle"),
                row.get("employee_id"),
                row.get("employee_name"),
                row.get("state"),
                row.get("zone"),
                row.get("region"),
                row.get("district"),
                row.get("resolved_by"),
                _fmt_date(row.get("resolved_date")),
                _fmt_time(row.get("resolved_time")),
                row.get("remark"),
                row.get("last_cpc_by"),
                row.get("last_cpc_comment"),
            ]
            line = ",".join('"%s"' % str(v if v is not None else "").replace('"', '""') for v in vals)
            buf.write(line + "\n")
    return "﻿" + buf.getvalue()  # BOM so Excel opens it correctly


def _export_filename():
    from frappe.utils import nowdate
    return "Account_Service_Report_%s.csv" % nowdate()


@frappe.whitelist()
def export_report(filters=None):
    """Small export → CSV content returned directly.
    Large export → background job; user gets realtime + email with the file."""
    if isinstance(filters, str):
        import json
        filters = json.loads(filters)
    filters = filters or {}

    conditions, params = _build_conditions(filters)
    where_clause = "WHERE " + " AND ".join(conditions)
    cnt = frappe.db.sql(
        f"SELECT COUNT(*) FROM `tabSahayog Ticket` st {where_clause}", params)
    total = cnt[0][0] if cnt else 0

    if total <= SYNC_EXPORT_LIMIT:
        data = get_report_data(filters=filters, page_no=1, page_size=max(total, 1))["data"]
        return {"mode": "sync", "content": _build_export_csv(data),
                "filename": _export_filename()}

    frappe.enqueue(
        export_report_job,
        filters=filters,
        user=frappe.session.user,
        queue="long",
        job_id="asr_export_%s" % frappe.session.user,
        deduplicate=True,
    )
    return {"mode": "queued", "total": total}


def export_report_job(filters, user):
    """Background CSV build: saves the file, notifies user (realtime + email)."""
    data = get_report_data(filters=filters, page_no=1, page_size=10 ** 6)["data"]
    content = _build_export_csv(data)

    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": _export_filename(),
        "is_private": 1,
        "content": content,
    }).insert(ignore_permissions=True)
    frappe.db.commit()

    file_url = file_doc.file_url
    link = frappe.utils.get_url(file_url)

    frappe.publish_realtime(
        "asr_export_ready",
        {"file_url": file_url, "file_name": file_doc.file_name, "rows": len(data)},
        user=user,
    )
    try:
        frappe.sendmail(
            recipients=[user],
            subject="Account Service Report export is ready (%s rows)" % len(data),
            message='Your Account Service Report export is ready.<br><br>'
                    '<a href="%s">Download %s</a>' % (link, file_doc.file_name),
        )
    except Exception:
        frappe.log_error("ASR export email failed", title="ASR export email failed")


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

    # Per-column text search (keys whitelisted; values parameterized).
    col_search = filters.get("column_search") or {}
    if isinstance(col_search, dict):
        simple_cols = {
            "ticket": "st.name", "sol_id": "st.sol_id", "branch": "st.branch",
            "status": "st.status", "response_pending": "st.response_pending",
            "state": "st.state", "zone": "st.zone", "region": "st.region",
            "district": "st.district",
        }
        for key, raw in col_search.items():
            val = (raw or "").strip()
            if not val:
                continue
            like = "%" + val + "%"
            if key in simple_cols:
                conditions.append(f"{simple_cols[key]} LIKE %s")
                params.append(like)
            elif key == "employee":
                conditions.append("(st.employee_name LIKE %s OR st.employee_id LIKE %s)")
                params.extend([like, like])
            elif key == "request_type":
                conditions.append("""EXISTS (
                    SELECT 1 FROM `tabTicket Item` ti
                    WHERE ti.parent = st.name AND ti.request_type LIKE %s
                )""")
                params.append(like)
            elif key == "resolved_by":
                conditions.append("st.ticket_resolved_user LIKE %s")
                params.append(like)
            elif key == "remark":
                conditions.append("st.resolved_remark LIKE %s")
                params.append(like)
            elif key == "comments":
                conditions.append("""EXISTS (
                    SELECT 1 FROM tabComment c
                    WHERE c.reference_doctype = 'Sahayog Ticket'
                      AND c.reference_name = st.name
                      AND c.comment_type = 'Comment' AND c.content LIKE %s
                )""")
                params.append(like)
            elif key in ("creation_date", "resolved_date"):
                col = "st.creation" if key == "creation_date" else "st.ticket_resolved_on"
                conditions.append(
                    f"(DATE_FORMAT({col}, '%%d-%%m-%%Y') LIKE %s OR DATE({col}) LIKE %s)")
                params.extend([like, like])
            elif key == "modified":
                conditions.append("st.modified LIKE %s")
                params.append(like)
            elif key == "cycle":
                conditions.append("""(
                    SELECT COUNT(*) FROM `tabVersion` v
                    WHERE v.ref_doctype = 'Sahayog Ticket'
                      AND v.docname = st.name
                      AND v.data LIKE %s
                      AND EXISTS (
                            SELECT 1 FROM JSON_TABLE(
                                v.data, '$.changed[*]' COLUMNS (
                                    fname  VARCHAR(64) PATH '$[0]',
                                    oldval VARCHAR(64) PATH '$[1]',
                                    newval VARCHAR(64) PATH '$[2]'
                                )
                            ) jt
                            WHERE jt.fname = 'response_pending'
                              AND jt.oldval IN ('Pending Branch', 'Pending Operations')
                              AND jt.newval IN ('Pending Branch', 'Pending Operations')
                      )
                ) LIKE %s""")
                params.extend(['%"response_pending"%', like])

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
           ORDER BY creation ASC""",
        (ticket,), as_dict=True,
    )
    out = []
    name_cache = {}
    side_cache = {}
    email_cache = {}
    for r in rows:
        by = r.comment_by or ""
        # Normalize comment_by to email when it was stored as a full name
        # (e.g. by Frappe's standard comment box), so the client can match
        # the current user's own comments reliably.
        if by and "@" not in by:
            if by not in email_cache:
                u = frappe.db.get_value("User", {"full_name": by}, "name")
                email_cache[by] = u or by
            by = email_cache[by]
        out.append({
            "by":   by,
            "name": _display_name(r.comment_by, name_cache),
            "side": _comment_side(by, side_cache),
            "text": _strip_html(r.content or ""),
            "on":   str(r.creation) if r.creation else "",
        })
    # Password parity: hide secret-mentioning comments from non-viewers.
    dept = frappe.db.get_value("Sahayog Ticket", ticket, "dept_name")
    if dept == "CBS" and not _can_view_ticket_password(ticket):
        out = [c for c in out if not _is_sensitive(c["text"])]
    return out


def _comment_side(by, cache):
    """Role-based side label for a comment author: Operations or Branch."""
    if not by:
        return ""
    if by not in cache:
        roles = set(frappe.get_roles(by))
        cache[by] = "Operations" if roles & OPERATIONS_ROLES else "Branch"
    return cache[by]


def _display_name(by, cache):
    """Email -> User full name for display (storage stays as-is)."""
    if not by:
        return ""
    if "@" not in by:
        return by
    if by not in cache:
        u = frappe.db.get_value("User", by, ["first_name", "last_name"], as_dict=True)
        full = " ".join(x for x in ((u.first_name if u else ""), (u.last_name if u else "")) if x).strip()
        cache[by] = full or by.split("@")[0]
    return cache[by]


@frappe.whitelist()
def get_ticket_detail(ticket):
    """Raised-by employee, resolver, files and assignees for the dialog."""
    t = frappe.get_doc("Sahayog Ticket", ticket)
    emp = None
    if t.employee_id and frappe.db.exists("Employee", t.employee_id):
        emp = frappe.db.get_value(
            "Employee", t.employee_id,
            ["employee_name", "designation", "department", "branch",
             "cell_number", "personal_email", "company_email"], as_dict=True)
    resolver = None
    if t.ticket_resolved_by:
        name_cache = {}
        rname = _display_name(t.ticket_resolved_by, name_cache)
        rdesg = rbranch = ""
        emp_id = frappe.db.get_value("Employee", {"user_id": t.ticket_resolved_by}, "name")
        if emp_id:
            rdesg = frappe.db.get_value("Employee", emp_id, "designation") or ""
            rbranch = frappe.db.get_value("Employee", emp_id, "branch") or ""
        resolver = {
            "name": rname,
            "on": str(t.ticket_resolved_on) if t.ticket_resolved_on else "",
            "remark": (t.resolved_remark or "").strip(),
            "designation": rdesg,
            "branch": rbranch,
        }
    files = frappe.get_all(
        "File",
        {"attached_to_doctype": "Sahayog Ticket", "attached_to_name": ticket},
        ["file_name", "file_url"], order_by="creation")
    assignees = frappe.db.sql(
        """SELECT u.name AS value,
                  CONCAT_WS(' ', NULLIF(u.first_name, ''), NULLIF(u.last_name, '')) AS label
           FROM tabUser u INNER JOIN `tabHas Role` r ON r.parent = u.name
            WHERE r.role = 'Operations Support Executive' AND u.enabled = 1 AND u.name NOT LIKE '%administrator%'
           GROUP BY u.name ORDER BY label""", as_dict=True)
    return {"employee": emp, "resolver": resolver, "files": files, "assignees": assignees}


@frappe.whitelist()
def get_filter_options():
    """Return dropdown options for Request Type and SOL ID.

    Request types are sourced from the Sahayog Ticket child table
    (Ticket Item) `request_type` Select field, so the report dropdown
    only shows the options actually defined there.
    """
    request_types = []
    rt_field = frappe.get_meta("Ticket Item").get_field("request_type")
    if rt_field and rt_field.options:
        raw = rt_field.options
        opts = raw.split("\n") if isinstance(raw, str) else list(raw or [])
        request_types = [str(o).strip() for o in opts if str(o).strip()]
        # Temporarily disabled request types stay in the doctype (so old
        # records keep validating) but are hidden from the report filter.
        request_types = [rt for rt in request_types
                         if rt not in DISABLED_REQUEST_TYPES]

    return {
        "request_types": request_types,
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


@frappe.whitelist()
def attach_file_to_ticket(ticket, file_url):
    """Link an already-uploaded File doc to a Sahayog Ticket and post a comment.

    Called from the ASR report dialog after frappe.ui.FileUploader completes.
    Avoids passing doctype/docname to FileUploader (which triggers an internal
    frappe.client.save and causes a document-modified conflict error when the
    ticket was recently updated).
    """
    file_url = (file_url or "").strip()
    if not file_url:
        frappe.throw("file_url is required.")

    # Find the File doc by URL and re-link it to this ticket.
    file_name = frappe.db.get_value("File", {"file_url": file_url}, "name")
    if file_name:
        frappe.db.set_value(
            "File", file_name,
            {
                "attached_to_doctype": "Sahayog Ticket",
                "attached_to_name":    ticket,
                "is_private":          0,
            },
            update_modified=False,   # don't touch the Ticket's modified stamp
        )

    # Post a comment so the chat shows the attachment.
    display = frappe.db.get_value("File", {"file_url": file_url}, "file_name") or file_url
    frappe.get_doc({
        "doctype":           "Comment",
        "comment_type":      "Comment",
        "reference_doctype": "Sahayog Ticket",
        "reference_name":    ticket,
        "content":           frappe.utils.escape_html("Attached: " + display),
        "comment_by":        frappe.session.user,
    }).insert(ignore_permissions=True)

    return {"status": "ok", "file_name": display}


# ---------------------------------------------------------------------------
# Agent Service Request report — same Page, isolated API methods.
# Account functions above are deliberately untouched.
# ---------------------------------------------------------------------------

AGENT_TICKET_TYPE = "Agent Service Request"


def _require_agent_read():
    if not frappe.has_permission("Sahayog Ticket", "read"):
        frappe.throw("You do not have access to Agent Service Requests.",
                     frappe.PermissionError)


def _require_agent_ticket(ticket):
    """Both permission and ticket_type guard — no account record can leak."""
    _require_agent_read()
    actual = frappe.db.get_value("Sahayog Ticket", ticket, "ticket_type")
    if actual != AGENT_TICKET_TYPE:
        frappe.throw("This ticket is not an Agent Service Request.",
                     frappe.PermissionError)


def _build_agent_conditions(filters, exclude_status=False):
    filters = filters or {}
    conditions = ["st.ticket_type = %s"]
    params = [AGENT_TICKET_TYPE]

    allowed_statuses = ("Open", "In-Progress", "Resolved", "Closed")
    if not exclude_status and filters.get("statuses"):
        vals = [s for s in filters["statuses"] if s in allowed_statuses]
        if vals:
            conditions.append("st.status IN ({})".format(", ".join(["%s"] * len(vals))))
            params.extend(vals)

    if not exclude_status and filters.get("status") in allowed_statuses:
        conditions.append("st.status = %s")
        params.append(filters["status"])

    if filters.get("response_pending"):
        conditions.append("st.response_pending = %s")
        params.append(filters["response_pending"])

    for key, field in (("sub_type", "sub_type"), ("agent_code", "agent_code"),
                       ("branch_code", "branch_code")):
        if filters.get(key):
            conditions.append(
                "EXISTS (SELECT 1 FROM `tabTicket Item` ti "
                "WHERE ti.parent = st.name AND ti.{0} = %s)".format(field))
            params.append(filters[key])

    if filters.get("from_date"):
        conditions.append("DATE(st.creation) >= %s")
        params.append(filters["from_date"])
    if filters.get("to_date"):
        conditions.append("DATE(st.creation) <= %s")
        params.append(filters["to_date"])

    col_search = filters.get("column_search") or {}
    if isinstance(col_search, dict):
        simple_cols = {
            "ticket": "st.name", "status": "st.status",
            "response_pending": "st.response_pending", "priority": "st.priority",
            "state": "st.state", "zone": "st.zone", "region": "st.region",
            "district": "st.district", "modified": "st.modified",
        }
        item_cols = ("sub_type", "agent_code", "agent_name",
                     "branch_code", "branch_name")
        for key, raw in col_search.items():
            val = (raw or "").strip()
            if not val:
                continue
            like = "%" + val + "%"
            if key in simple_cols:
                conditions.append("{0} LIKE %s".format(simple_cols[key]))
                params.append(like)
            elif key in item_cols:
                conditions.append(
                    "EXISTS (SELECT 1 FROM `tabTicket Item` ti "
                    "WHERE ti.parent = st.name AND ti.{0} LIKE %s)".format(key))
                params.append(like)
            elif key == "assigned_to":
                conditions.append("(st.assigned_to LIKE %s OR st.assigned_to_name LIKE %s)")
                params.extend([like, like])
            elif key == "employee":
                conditions.append("(st.employee_name LIKE %s OR st.employee_id LIKE %s)")
                params.extend([like, like])
            elif key == "resolved_by":
                conditions.append("st.ticket_resolved_user LIKE %s")
                params.append(like)
            elif key == "remark":
                conditions.append("st.resolved_remark LIKE %s")
                params.append(like)
            elif key == "comments":
                conditions.append("""EXISTS (
                    SELECT 1 FROM tabComment c
                    WHERE c.reference_doctype = 'Sahayog Ticket'
                      AND c.reference_name = st.name
                      AND c.comment_type = 'Comment' AND c.content LIKE %s
                )""")
                params.append(like)
            elif key in ("creation_date", "resolved_date"):
                col = "st.creation" if key == "creation_date" else "st.ticket_resolved_on"
                conditions.append(
                    "(DATE_FORMAT({0}, '%%d-%%m-%%Y') LIKE %s "
                    "OR DATE({0}) LIKE %s)".format(col))
                params.extend([like, like])

    return conditions, params


def _agent_updates(rows):
    """Dynamic Request Field values, grouped per ticket for the dialog."""
    key_map = {}
    keys = []
    for r in rows:
        key = r.get("item_key") or ""
        if key:
            keys.append(key)
            key_map[key] = (r.get("ticket"), r.get("sub_type") or "Agent Request")
    if not keys:
        return {}

    labels = {}
    for f in frappe.get_all("Request Field", fields=["field_key", "label"]):
        labels[f.field_key] = f.label or f.field_key

    values = {}
    for start in range(0, len(keys), 500):
        chunk = keys[start:start + 500]
        for v in frappe.get_all(
                "Ticket Item Value",
                filters={"item_key": ["in", chunk]},
                fields=["item_key", "field_key", "value_data", "value_text",
                        "value_date", "value_display"],
                order_by="idx asc"):
            val = (v.value_display or v.value_data or v.value_text
                   or (str(v.value_date) if v.value_date else ""))
            val = str(val).strip()
            if not val:
                continue
            values.setdefault(v.item_key, []).append({
                "label": labels.get(v.field_key, v.field_key),
                "value": val,
            })

    out = {}
    for key, (ticket, sub_type) in key_map.items():
        lines = values.get(key) or []
        if lines:
            out[ticket] = [{
                "title": sub_type,
                "groups": [{"section": "", "lines": lines}],
            }]
    return out


@frappe.whitelist()
def agent_get_report_data(filters=None, page_no=1, page_size=20):
    """Agent-only report rows + summary. Never returns account tickets."""
    _require_agent_read()
    if isinstance(filters, str):
        import json
        filters = json.loads(filters)
    filters = filters or {}
    page_no = int(page_no)
    page_size = int(page_size)
    offset = (page_no - 1) * page_size

    conditions, params = _build_agent_conditions(filters)
    where_clause = "WHERE " + " AND ".join(conditions)

    count_row = frappe.db.sql(
        f"SELECT COUNT(*) as cnt FROM `tabSahayog Ticket` st {where_clause}",
        params, as_dict=True)
    total = count_row[0].cnt if count_row else 0

    query = f"""
        SELECT
            st.name AS ticket,
            st.status, st.dept_name, st.response_pending, st.ticket_type,
            st.priority, st.assigned_to, st.assigned_to_name,
            st.employee_id, st.employee_name,
            st.state, st.zone, st.region, st.district,
            st.ticket_resolved_user AS resolved_by, st.ticket_resolved_on,
            st.resolved_remark, st.executive_remark, st.creation, st.modified,
            (SELECT ti.sub_type FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS sub_type,
            (SELECT ti.agent_code FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS agent_code,
            (SELECT ti.agent_name FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS agent_name,
            (SELECT ti.branch_code FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS branch_code,
            (SELECT ti.branch_name FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS branch_name,
            (SELECT ti.item_key FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS item_key,
            (SELECT COUNT(*) FROM tabComment c
              WHERE c.reference_doctype = 'Sahayog Ticket'
                AND c.reference_name = st.name
                AND c.comment_type = 'Comment') AS comments_count,
            (SELECT c.content FROM tabComment c
              WHERE c.reference_doctype = 'Sahayog Ticket'
                AND c.reference_name = st.name
                AND c.comment_type = 'Comment'
              ORDER BY c.creation DESC LIMIT 1) AS last_comment,
            (SELECT c.comment_by FROM tabComment c
              WHERE c.reference_doctype = 'Sahayog Ticket'
                AND c.reference_name = st.name
                AND c.comment_type = 'Comment'
              ORDER BY c.creation DESC LIMIT 1) AS last_comment_by,
            DATE(st.ticket_resolved_on) AS resolved_date,
            TIME(st.ticket_resolved_on) AS resolved_time
        FROM `tabSahayog Ticket` st
        {where_clause}
        ORDER BY st.modified DESC
        LIMIT %s OFFSET %s
    """
    rows = frappe.db.sql(query, params + [page_size, offset], as_dict=True)
    handoffs = _handoff_counts([t.ticket for t in rows])
    updates = _agent_updates(rows)

    data = []
    for t in rows:
        data.append({
            "ticket":            t.ticket,
            "creation_date":     str(getdate(t.creation)) if t.creation else "",
            "creation_time":     str(get_time(t.creation)) if t.creation else "",
            "modified":          str(t.modified) if t.modified else "",
            "status":            t.status or "",
            "dept_name":         t.dept_name or "",
            "response_pending":  t.response_pending or "",
            "ticket_type":       t.ticket_type or "",
            "priority":          t.priority or "",
            "sub_type":          t.sub_type or "",
            "agent_code":        t.agent_code or "",
            "agent_name":        t.agent_name or "",
            "branch_code":       t.branch_code or "",
            "branch_name":       t.branch_name or "",
            "assigned_to":       t.assigned_to or "",
            "assigned_to_name":  t.assigned_to_name or "",
            "employee_id":       t.employee_id or "",
            "employee_name":     t.employee_name or "",
            "state":             t.state or "",
            "zone":              t.zone or "",
            "region":            t.region or "",
            "district":          t.district or "",
            "ticket_cycle":      handoffs.get(t.ticket, 0),
            "resolved_by":       t.resolved_by or "",
            "resolved_date":     str(t.resolved_date) if t.resolved_date else "",
            "resolved_time":     str(t.resolved_time) if t.resolved_time else "",
            "remark":            (t.get("resolved_remark") or "").strip(),
            "executive_remark":  (t.get("executive_remark") or "").strip(),
            "comments_count":    t.comments_count or 0,
            "last_comment":      _strip_html(t.last_comment or ""),
            "last_comment_by":   t.last_comment_by or "",
            "updates":           updates.get(t.ticket, []),
        })

    sum_filters = dict(filters or {})
    sum_filters.pop("response_pending", None)
    sum_conditions, sum_params = _build_agent_conditions(sum_filters, exclude_status=True)
    summary = _get_summary(sum_conditions, sum_params)

    rp_filters = dict(filters or {})
    rp_filters.pop("response_pending", None)
    rp_conditions, rp_params = _build_agent_conditions(rp_filters, exclude_status=True)
    rp_conditions.append("st.status IN ('Open','In-Progress')")
    rp_rows = frappe.db.sql(
        f"""SELECT st.response_pending, COUNT(*) as cnt
            FROM `tabSahayog Ticket` st
            WHERE {" AND ".join(rp_conditions)}
            GROUP BY st.response_pending""",
        rp_params, as_dict=True)
    for r in rp_rows:
        key = r.response_pending or ""
        if key in ("Pending Operations", "Pending Branch"):
            summary[key] = summary.get(key, 0) + r.cnt
    summary.setdefault("Pending Operations", 0)
    summary.setdefault("Pending Branch", 0)

    _attach_last_cpc_comment(data)
    return {
        "data": data, "total": total, "page_no": page_no,
        "page_size": page_size, "summary": summary,
    }


@frappe.whitelist()
def agent_get_filter_options():
    """Agent sub types and agent codes for the same report page."""
    _require_agent_read()
    sub_types = [
        r.sub_type_name or r.name
        for r in frappe.get_all(
            "Service Request Sub Type",
            filters={"ticket_type": AGENT_TICKET_TYPE, "is_active": 1},
            fields=["name", "sub_type_name"], order_by="name asc")
    ]
    agent_codes = frappe.get_all(
        "Agent", fields=["name as agent_code", "agent_name"],
        order_by="agent_name asc", limit_page_length=0)
    branch_codes = []
    seen = set()
    for b in frappe.get_all(
            "Agent", fields=["branch_code", "branch_name"],
            order_by="branch_code asc", limit_page_length=0):
        code = (b.branch_code or "").strip()
        if not code or code in seen:
            continue
        seen.add(code)
        branch_codes.append({"branch_code": code, "branch_name": b.branch_name or ""})
    return {
        "sub_types": sub_types,
        "agent_codes": agent_codes,
        "branch_codes": branch_codes,
    }


@frappe.whitelist()
def agent_get_ticket_comments(ticket):
    _require_agent_ticket(ticket)
    return get_ticket_comments(ticket)


@frappe.whitelist()
def agent_get_ticket_detail(ticket):
    _require_agent_ticket(ticket)
    detail = get_ticket_detail(ticket)
    detail["employee"] = None

    # Raised-by panel: agent master details (account panel uses Employee).
    agent_code = frappe.db.get_value("Ticket Item", {"parent": ticket}, "agent_code")
    agent = None
    if agent_code and frappe.db.exists("Agent", agent_code):
        agent = frappe.db.get_value(
            "Agent", agent_code,
            ["name", "agent_name", "phone_number", "branch_code",
             "branch_name", "role", "status", "requested_by"],
            as_dict=True)
    detail["agent"] = agent
    return detail


@frappe.whitelist()
def agent_add_ticket_comment(ticket, text):
    _require_agent_ticket(ticket)
    return add_ticket_comment(ticket, text)


@frappe.whitelist()
def agent_attach_file_to_ticket(ticket, file_url):
    _require_agent_ticket(ticket)
    return attach_file_to_ticket(ticket, file_url)


AGENT_CSV_HEADERS = [
    "Last Modified", "Ticket", "Creation Date", "Creation Time",
    "Request Type", "Agent Code", "Agent Name", "Branch Code", "Branch Name",
    "Status", "Response Pending", "Ticket Cycle", "Priority",
    "Assigned To", "Resolved By", "Resolved Date", "Resolved Time",
    "Resolver Remark", "Last Comment By", "Last Comment",
]


def _build_agent_export_csv(data):
    import io

    buf = io.StringIO()
    buf.write(",".join(AGENT_CSV_HEADERS) + "\n")
    for row in data:
        vals = [
            _fmt_modified(row.get("modified")),
            row.get("ticket"),
            _fmt_date(row.get("creation_date")),
            _fmt_time(row.get("creation_time")),
            row.get("sub_type"),
            row.get("agent_code"),
            row.get("agent_name"),
            row.get("branch_code"),
            row.get("branch_name"),
            row.get("status"),
            row.get("response_pending"),
            row.get("ticket_cycle"),
            row.get("priority"),
            row.get("assigned_to_name") or row.get("assigned_to"),
            row.get("resolved_by"),
            _fmt_date(row.get("resolved_date")),
            _fmt_time(row.get("resolved_time")),
            row.get("remark"),
            row.get("last_cpc_by"),
            row.get("last_cpc_comment"),
        ]
        line = ",".join(
            '"%s"' % str(v if v is not None else "").replace('"', '""')
            for v in vals)
        buf.write(line + "\n")
    return "\ufeff" + buf.getvalue()


def _agent_export_filename():
    from frappe.utils import nowdate
    return "Agent_Service_Report_%s.csv" % nowdate()


@frappe.whitelist()
def agent_export_report(filters=None):
    _require_agent_read()
    if isinstance(filters, str):
        import json
        filters = json.loads(filters)
    filters = filters or {}

    conditions, params = _build_agent_conditions(filters)
    where_clause = "WHERE " + " AND ".join(conditions)
    cnt = frappe.db.sql(
        f"SELECT COUNT(*) FROM `tabSahayog Ticket` st {where_clause}", params)
    total = cnt[0][0] if cnt else 0

    if total <= SYNC_EXPORT_LIMIT:
        data = agent_get_report_data(
            filters=filters, page_no=1, page_size=max(total, 1))["data"]
        return {
            "mode": "sync",
            "content": _build_agent_export_csv(data),
            "filename": _agent_export_filename(),
        }

    frappe.enqueue(
        agent_export_report_job,
        filters=filters,
        user=frappe.session.user,
        queue="long",
        job_id="asr_agent_export_%s" % frappe.session.user,
        deduplicate=True,
    )
    return {"mode": "queued", "total": total}


def agent_export_report_job(filters, user):
    data = agent_get_report_data(filters=filters, page_no=1,
                                page_size=10 ** 6)["data"]
    content = _build_agent_export_csv(data)

    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": _agent_export_filename(),
        "is_private": 1,
        "content": content,
    }).insert(ignore_permissions=True)
    frappe.db.commit()

    file_url = file_doc.file_url
    link = frappe.utils.get_url(file_url)
    frappe.publish_realtime(
        "asr_agent_export_ready",
        {"file_url": file_url, "file_name": file_doc.file_name, "rows": len(data)},
        user=user,
    )
    try:
        frappe.sendmail(
            recipients=[user],
            subject="Agent Service Report export is ready (%s rows)" % len(data),
            message='Your Agent Service Report export is ready.<br><br>'
                    '<a href="%s">Download %s</a>' % (link, file_doc.file_name),
        )
    except Exception:
        frappe.log_error("ASR agent export email failed",
                         title="ASR agent export email failed")
