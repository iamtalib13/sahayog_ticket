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
    items = frappe.get_all("Ticket Item", {"parent": ticket}, ["name"] + keys, order_by="idx")
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
            out.append({"title": head, "groups": groups})
    return out

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
                SELECT ti.request_type FROM `tabTicket Item` ti
                WHERE ti.parent = st.name LIMIT 1
            ) AS request_type,
            (
                SELECT ti.account_number FROM `tabTicket Item` ti
                WHERE ti.parent = st.name LIMIT 1
            ) AS account_number,
            st.executive_remark,
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
            "ticket_cycle":     t.ticket_cycle or 0,
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

    # Summary counts by status (ignores the status filter so the
    # All/Pending/Completed tab counts stay global).
    sum_conditions, sum_params = _build_conditions(filters, exclude_status=True)
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


def _attach_last_cpc_comment(data):
    """Attach the LAST comment made by the ticket's ASSIGNED CPC user
    (assigned_to, any ticket status) as last_cpc_by / last_cpc_comment
    for the CSV. Comments by anyone else are ignored; if the assigned
    user never commented the cells stay empty. History is NOT included.
    """
    import html as _html

    for d in data:
        d["last_cpc_by"] = ""
        d["last_cpc_comment"] = ""
    if not data:
        return
    names = [d["ticket"] for d in data]
    ph_t = ", ".join(["%s"] * len(names))
    crows = frappe.db.sql(
        f"""SELECT reference_name, comment_by, owner, content FROM tabComment
            WHERE reference_doctype = 'Sahayog Ticket'
              AND reference_name IN ({ph_t})
              AND comment_type = 'Comment'
            ORDER BY creation ASC""",
        tuple(names), as_dict=True)
    by_ticket = {x["ticket"]: x for x in data}
    for c in crows:
        d = by_ticket.get(c.reference_name)
        if not d:
            continue
        assigned = (d.get("assigned_to") or "").strip().lower()
        if not assigned:
            continue
        # comment_by may hold a display name (e.g. "TUSHAR UMBARKAR") or an
        # uppercased id ("ADMINISTRATOR") — owner holds the real user id.
        # Match either, case-insensitively.
        owner = (c.owner or "").strip()
        by = (c.comment_by or "").strip()
        if owner.lower() == assigned or by.lower() == assigned:
            # Oldest-first order: each match overwrites → last wins.
            d["last_cpc_by"] = owner or by
            d["last_cpc_comment"] = _html.unescape(_strip_html(c.content or ""))


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


def _build_export_csv(data):
    import io

    buf = io.StringIO()
    buf.write(",".join(CSV_HEADERS) + "\n")
    for row in data:
        vals = [
            _fmt_modified(row.get("modified")),
            row.get("ticket"),
            _fmt_date(row.get("creation_date")),
            _fmt_time(row.get("creation_time")),
            row.get("request_type"),
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
                    SELECT COUNT(*) FROM `tabTicket Status Log` tsl
                    WHERE tsl.parent = st.name
                ) LIKE %s""")
                params.append(like)

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
    for r in rows:
        out.append({
            "by":   r.comment_by or "",
            "name": _display_name(r.comment_by, name_cache),
            "text": _strip_html(r.content or ""),
            "on":   str(r.creation) if r.creation else "",
        })
    # Password parity: hide secret-mentioning comments from non-viewers.
    dept = frappe.db.get_value("Sahayog Ticket", ticket, "dept_name")
    if dept == "CBS" and not _can_view_ticket_password(ticket):
        out = [c for c in out if not _is_sensitive(c["text"])]
    return out


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
