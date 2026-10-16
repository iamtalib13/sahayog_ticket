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

    # Operations-side comments for the CSV export (all of them, oldest first).
    _attach_ops_comments(data)

    return {
        "data":     data,
        "total":    total,
        "page_no":  page_no,
        "page_size":page_size,
        "summary":  summary,
    }


def _attach_ops_comments(data):
    """All comments by Operations Support Executive holders, per ticket."""
    for d in data:
        d["ops_comments"] = ""
        d["ops_comments_by"] = ""
    if not data:
        return
    ops_users = [r[0] for r in frappe.db.sql(
        """SELECT parent FROM `tabHas Role`
           WHERE role = 'Operations Support Executive' AND parenttype = 'User'""")]
    if not ops_users:
        return
    names = [d["ticket"] for d in data]
    ph_t = ", ".join(["%s"] * len(names))
    ph_u = ", ".join(["%s"] * len(ops_users))
    crows = frappe.db.sql(
        f"""SELECT reference_name, comment_by, content FROM tabComment
            WHERE reference_doctype = 'Sahayog Ticket'
              AND reference_name IN ({ph_t})
              AND comment_type = 'Comment' AND comment_by IN ({ph_u})
            ORDER BY creation ASC""",
        tuple(names) + tuple(ops_users), as_dict=True)
    grouped = {}
    for c in crows:
        grouped.setdefault(c.reference_name, []).append(c)
    name_cache = {}
    for d in data:
        items = grouped.get(d["ticket"], [])
        if not items:
            continue
        bys = []
        parts = []
        for c in items:
            nm = _display_name(c.comment_by, name_cache)
            if nm not in bys:
                bys.append(nm)
            parts.append(_strip_html(c.content or ""))
        d["ops_comments_by"] = ", ".join(bys)
        words = ["first", "second", "third", "fourth", "fifth", "sixth",
                 "seventh", "eighth", "ninth", "tenth"]
        numbered = []
        for i, p in enumerate([x for x in parts if x]):
            w = words[i] if i < len(words) else "%dth" % (i + 1)
            numbered.append("%s comment : %s" % (w, p))
        d["ops_comments"] = ", ".join(numbered)


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
            WHERE r.role IN ('CPC Loan User', 'Operations Support Executive') AND u.enabled = 1 AND u.name NOT LIKE '%administrator%'
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
