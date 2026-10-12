"""Minimal Account Service dashboard APIs.

Only Account Service Request tickets. Reuses Sahayog Ticket controller
(validations, status log, mails) by saving via Document API — no bypass.
Roles reused from system: Branch User, CPC Loan User, Helpdesk Contact.
"""

import frappe

TICKET_TYPE = "Account Service Request"
OPEN_STATES = ("Open", "In-Progress")

SERVICE_TYPES = [
    "Change of Address",
    "Update Contact Number",
    "Update Email Address",
    "Update KYC (Adhaar/Voter/Passport/etc)",
    "Update PAN NO",
    "Update Signature",
    "Name Change",
    "Activation of Dormant account",
    "SMS Alert Registration",
    "Nomination Addition/ Deletion/ Modification",
    "Account Transfer",
    "DOB Updation",
]


def _my_role():
    roles = set(frappe.get_roles(frappe.session.user))
    if "Contact Service" in roles or "Helpdesk Contact" in roles or frappe.session.user == "Administrator":
        return "helpdesk"
    if "CPC Loan User" in roles:
        return "cpc"
    return "branch"  # default: Branch User / normal employee


def _tat_breached(total_days, tat):
    """Best-effort TAT check. tat like '3 Day' / '4 Hours', total_days numeric."""
    try:
        days = float(total_days or 0)
    except (TypeError, ValueError):
        return False
    if not tat or tat == "Not-Defined":
        return False
    try:
        num = float(str(tat).split()[0])
    except (ValueError, IndexError):
        return False
    limit = num / 24.0 if "hour" in str(tat).lower() else num
    return days > limit


def _ticket_base_query(user_filter_sql="", params=None):
    """Shared WHERE builder. Returns (where, params)."""
    where = ["st.ticket_type = %(tt)s"]
    vals = {"tt": TICKET_TYPE}
    if user_filter_sql:
        where.append(user_filter_sql)
    if params:
        vals.update(params)
    return " AND ".join(where), vals


def _fetch_tickets(where, vals, limit=50):
    rows = frappe.db.sql(
        f"""
        SELECT st.name, st.status, st.response_pending, st.priority,
            st.employee_id, st.employee_name, st.branch, st.sol_id,
            st.assigned_to, st.assigned_to_name, st.owner,
            st.dept_name,
            st.creation,
            st.modified,
            st.due_time, st.tat, st.total_days,
            (SELECT ti.request_type FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS request_type,
            (SELECT ti.account_number FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS account_number,
            (SELECT ti.customer_name FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS customer_name
        FROM `tabSahayog Ticket` st
        WHERE {where}
        ORDER BY st.modified DESC
        LIMIT {int(limit)}
        """,
        vals,
        as_dict=True,
    )
    out = []
    for r in rows:
        d = dict(r)
        d["breached"] = _tat_breached(r.get("total_days"), r.get("tat"))
        d["step"] = _step_for(r)
        out.append(d)
    return out


def _step_for(t):
    """Stepper stage 1-5: Raised > Assigned > In Work > Resolved > Closed."""
    status = t.get("status")
    if status == "Closed":
        return 5
    if status == "Resolved":
        return 4
    if status in ("In-Progress",):
        return 3
    # Open: assigned or not
    if t.get("assigned_to"):
        return 2
    return 1


def _count(where, vals):
    return frappe.db.sql(
        f"SELECT COUNT(*) FROM `tabSahayog Ticket` st WHERE {where}",
        vals,
    )[0][0]


@frappe.whitelist()
def get_dashboard_data(view="all", tab="all", service_type=None, agent=None,
                       department=None, assigned_to_me=0, q_id=None,
                       q_customer=None, q_account=None, status_exact=None, rp=None):
    """Role-aware counters + tab counts + filtered ticket list.

    view: legacy Desk views (all|mine|unassigned|pending_branch|verify|breached).
    tab: portal tabs (all|pending|closed).
    Dropdowns: service_type (request_type), agent (assigned_to), department.
    assigned_to_me: 1 → only my tickets. q_*: per-column search text.
    """
    user = frappe.session.user
    role = _my_role()
    u = frappe.db.escape(user)

    if role == "branch":
        scope, vals = _ticket_base_query(f"st.owner = {u}")
    elif role == "cpc":
        scope, vals = _ticket_base_query(
            f"(st.assigned_to = {u} OR st.assigned_to IS NULL OR st.assigned_to = '')"
        )
    else:
        scope, vals = _ticket_base_query()

    open_w, _ = _ticket_base_query(
        (f"st.owner = {u} AND " if role == "branch" else "")
        + "st.status IN ('Open', 'In-Progress')"
    ) if role == "branch" else (scope + " AND st.status IN ('Open', 'In-Progress')", vals)
    if role == "branch":
        open_where, open_vals = _ticket_base_query(
            f"st.owner = {u} AND st.status IN ('Open', 'In-Progress')"
        )
    else:
        open_where, open_vals = scope + " AND st.status IN ('Open', 'In-Progress')", vals

    if role == "branch":
        pb_where, pb_vals = _ticket_base_query(
            f"st.owner = {u} AND st.response_pending = 'Pending Branch'"
            " AND st.status IN ('Open', 'In-Progress')"
        )
        verify_where, verify_vals = _ticket_base_query(
            f"st.owner = {u} AND st.status = 'Resolved'"
        )
        closed_where, closed_vals = _ticket_base_query(
            f"st.owner = {u} AND st.status = 'Closed'"
            " AND st.modified >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        )
        counters = [
            {"key": "mine_open", "label": "My Open", "value": _count(open_where, open_vals)},
            {"key": "pending_branch", "label": "Info Needed", "value": _count(pb_where, pb_vals)},
            {"key": "verify", "label": "Verify & Close", "value": _count(verify_where, verify_vals)},
            {"key": "closed", "label": "Closed (30d)", "value": _count(closed_where, closed_vals)},
        ]
    elif role == "cpc":
        pool_where, pool_vals = _ticket_base_query(
            "st.status = 'Open' AND (st.assigned_to IS NULL OR st.assigned_to = '')"
        )
        mywork_where, mywork_vals = _ticket_base_query(
            f"st.assigned_to = {u} AND st.status IN ('Open', 'In-Progress')"
        )
        wait_where, wait_vals = _ticket_base_query(
            f"st.assigned_to = {u} AND st.response_pending = 'Pending Branch'"
            " AND st.status IN ('Open', 'In-Progress')"
        )
        done_where, done_vals = _ticket_base_query(
            f"st.ticket_resolved_by = {u} AND st.status IN ('Resolved', 'Closed')"
            " AND st.ticket_resolved_on >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        )
        counters = [
            {"key": "pool", "label": "Unassigned Pool", "value": _count(pool_where, pool_vals)},
            {"key": "mywork", "label": "My Work", "value": _count(mywork_where, mywork_vals)},
            {"key": "pending_branch", "label": "Waiting on Branch", "value": _count(wait_where, wait_vals)},
            {"key": "done", "label": "Done (7d)", "value": _count(done_where, done_vals)},
        ]
    else:
        new_where, new_vals = _ticket_base_query(
            "st.status = 'Open' AND (st.assigned_to IS NULL OR st.assigned_to = '')"
        )
        pb_where, pb_vals = _ticket_base_query(
            "st.response_pending = 'Pending Branch' AND st.status IN ('Open', 'In-Progress')"
        )
        closed_where, closed_vals = _ticket_base_query(
            "st.status = 'Closed' AND st.modified >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        )
        counters = [
            {"key": "unassigned", "label": "New Unassigned", "value": _count(new_where, new_vals)},
            {"key": "open", "label": "Total Open", "value": _count(open_where, open_vals)},
            {"key": "pending_branch", "label": "Pending Branch", "value": _count(pb_where, pb_vals)},
            {"key": "closed", "label": "Closed (7d)", "value": _count(closed_where, closed_vals)},
        ]

    # Filter base: role scope + dropdown/search (tabs + list share it)
    list_where, list_vals = scope, dict(vals)

    # Portal dropdown + search filters (combined with AND)
    if department:
        list_where += " AND st.dept_name = %(f_dept)s"
        list_vals["f_dept"] = department
    if service_type:
        list_where += """ AND EXISTS (
            SELECT 1 FROM `tabTicket Item` ti
            WHERE ti.parent = st.name AND ti.request_type = %(f_stype)s)"""
        list_vals["f_stype"] = service_type
    if agent:
        list_where += " AND st.assigned_to = %(f_agent)s"
        list_vals["f_agent"] = agent
    if assigned_to_me and str(assigned_to_me) not in ("0", "false", "False"):
        list_where += f" AND st.assigned_to = {u}"
    if q_id:
        list_where += " AND st.name LIKE %(q_id)s"
        list_vals["q_id"] = f"%{q_id}%"
    if q_customer:
        list_where += " AND (st.employee_name LIKE %(q_cust)s OR EXISTS (" \
            "SELECT 1 FROM `tabTicket Item` ti WHERE ti.parent = st.name " \
            "AND ti.customer_name LIKE %(q_cust)s))"
        list_vals["q_cust"] = f"%{q_customer}%"
    if q_account:
        list_where += " AND EXISTS (SELECT 1 FROM `tabTicket Item` ti " \
            "WHERE ti.parent = st.name AND ti.account_number LIKE %(q_acc)s)"
        list_vals["q_acc"] = f"%{q_account}%"

    # Tab + response-pending badge counts (filter base, no tab applied)
    base, base_vals = list_where, dict(list_vals)
    tabs = {
        "all": _count(base, base_vals),
        "pending": _count(base + " AND st.status IN ('Open', 'In-Progress')", base_vals),
        "closed": _count(base + " AND st.status IN ('Resolved', 'Closed')", base_vals),
        "open": _count(base + " AND st.status = 'Open'", base_vals),
        "in_progress": _count(base + " AND st.status = 'In-Progress'", base_vals),
        "escalated": _count(base + " AND st.response_pending = 'Pending Branch'"
                              " AND st.status IN ('Open', 'In-Progress')", base_vals),
        "pending_operations": _count(base + " AND st.response_pending = 'Pending Operations'"
                              " AND st.status IN ('Open', 'In-Progress')", base_vals),
        "pending_branch": _count(base + " AND st.response_pending = 'Pending Branch'"
                              " AND st.status IN ('Open', 'In-Progress')", base_vals),
        "resolved_rp": _count(base + " AND st.response_pending = 'Resolved'"
                              " AND st.status IN ('Resolved', 'Closed')", base_vals),
    }
    tabs["breached"] = _breached_count(base, base_vals)

    # Portal tabs
    if tab == "pending":
        list_where += " AND st.status IN ('Open', 'In-Progress')"
    elif tab == "closed":
        list_where += " AND st.status IN ('Resolved', 'Closed')"
    if status_exact in ("Open", "In-Progress", "Resolved", "Closed"):
        list_where += " AND st.status = %(f_status)s"
        list_vals["f_status"] = status_exact
    if rp in ("Pending Operations", "Pending Branch", "Resolved"):
        list_where += " AND st.response_pending = %(f_rp)s"
        list_vals["f_rp"] = rp

    if view == "mine":
        if role == "branch":
            pass  # scope already owner-only
        elif role == "cpc":
            list_where = _ticket_base_query(f"st.assigned_to = {u}")[0]
            list_vals = {"tt": TICKET_TYPE}
        else:
            list_where, list_vals = _ticket_base_query(
                f"(st.owner = {u} OR st.assigned_to = {u})"
            )
    elif view == "unassigned":
        list_where += " AND (st.assigned_to IS NULL OR st.assigned_to = '') AND st.status IN ('Open', 'In-Progress')"
    elif view == "pending_branch":
        list_where += " AND st.response_pending = 'Pending Branch' AND st.status IN ('Open', 'In-Progress')"
    elif view == "verify":
        list_where += " AND st.status = 'Resolved'"
    tickets = _fetch_tickets(list_where, list_vals, limit=50)
    total = _count(list_where, list_vals)

    if view == "breached":
        tickets = [t for t in tickets if t["breached"]]

    options = {
        "departments": frappe.get_all("Departsection", pluck="name", order_by="name"),
        "service_types": SERVICE_TYPES,
        "agents": _agents_in_scope(scope, vals),
    }

    return {"role": role, "counters": counters, "tickets": tickets,
            "total": total, "tabs": tabs, "options": options}


def _strip_tab(where):
    """Remove portal tab status clauses so tab counts share one base."""
    out = where.replace(" AND st.status IN ('Open', 'In-Progress')", "")
    out = out.replace(" AND st.status IN ('Resolved', 'Closed')", "")
    return out


def _breached_count(where, vals):
    rows = frappe.db.sql(
        f"""SELECT st.total_days, st.tat FROM `tabSahayog Ticket` st
            WHERE {where} AND st.status IN ('Open', 'In-Progress')""",
        vals, as_dict=True,
    )
    return sum(1 for r in rows if _tat_breached(r.get("total_days"), r.get("tat")))


def _agents_in_scope(scope, vals):
    rows = frappe.db.sql(
        f"""SELECT DISTINCT st.assigned_to, st.assigned_to_name
            FROM `tabSahayog Ticket` st WHERE {scope}
            AND st.assigned_to IS NOT NULL AND st.assigned_to != ''""",
        vals,
    )
    return [{"email": r[0], "name": r[1] or r[0]} for r in rows]


def _save_ticket(name, updates):
    doc = frappe.get_doc("Sahayog Ticket", name)
    if doc.ticket_type != TICKET_TYPE:
        frappe.throw("Only Account Service Request tickets are allowed here.")
    for k, v in updates.items():
        doc.set(k, v)
    doc.save(ignore_permissions=False)
    return {"name": doc.name, "status": doc.status,
            "response_pending": doc.response_pending}


@frappe.whitelist()
def take_and_start(ticket):
    """CPC/Helpdesk: assign to self + In-Progress."""
    me = frappe.session.user
    if _my_role() == "branch":
        frappe.throw("Only CPC / Helpdesk can take tickets.")
    return _save_ticket(ticket, {"assigned_to": me, "status": "In-Progress"})


@frappe.whitelist()
def assign_ticket(ticket, user):
    """Helpdesk: assign to a CPC user."""
    if _my_role() not in ("helpdesk", "cpc"):
        frappe.throw("Only Helpdesk / CPC can assign.")
    return _save_ticket(ticket, {"assigned_to": user})


@frappe.whitelist()
def need_branch_info(ticket, remark=""):
    """CPC: ask branch for info."""
    if _my_role() not in ("cpc", "helpdesk"):
        frappe.throw("Only CPC / Helpdesk can ask branch.")
    return _save_ticket(ticket, {"response_pending": "Pending Branch",
                                 "executive_remark": remark or "Info needed from branch"})


@frappe.whitelist()
def submit_branch_info(ticket):
    """Branch: info submitted, back to operations."""
    return _save_ticket(ticket, {"response_pending": "Pending Operations"})


@frappe.whitelist()
def mark_resolved(ticket, remark):
    """CPC: resolve with mandatory remark."""
    if not remark:
        frappe.throw("Resolution remark is required.")
    if _my_role() not in ("cpc", "helpdesk"):
        frappe.throw("Only CPC / Helpdesk can resolve.")
    return _save_ticket(ticket, {"status": "Resolved", "response_pending": "Resolved",
                                 "resolved_remark": remark})


@frappe.whitelist()
def list_cpc_users():
    """Enabled users holding the CPC Loan User role (assign dropdown)."""
    rows = frappe.db.sql(
        """
        SELECT DISTINCT u.name, u.full_name
        FROM tabUser u
        INNER JOIN `tabHas Role` hr ON hr.parent = u.name AND hr.parenttype = 'User'
        WHERE hr.role = 'CPC Loan User' AND u.enabled = 1 AND u.name NOT IN ('Guest', 'Administrator')
        ORDER BY u.full_name
        """
    )
    return [{"email": r[0], "name": r[1] or r[0]} for r in rows]


@frappe.whitelist()
def create_account_request(args):
    """Create Account Service Request from custom minimal form.

    args (dict/JSON): request_type, account_number + customer fields
    + conditional new_* fields + attatchment.
    Employee snapshot auto-fills from owner via controller.
    """
    import json as _json

    if isinstance(args, str):
        args = _json.loads(args or "{}")
    args = dict(args or {})

    if not args.get("request_type"):
        frappe.throw("Request Type is required.")
    if not args.get("account_number"):
        frappe.throw("Account Number is required.")

    assigned_to = args.get("assigned_to") or None
    if assigned_to and _my_role() == "branch":
        frappe.throw("Only CPC / Contact Service can pre-assign tickets.")

    due_time = None
    if args.get("target_sla_date"):
        due_time = f"{args.get('target_sla_date')} 00:00:00"

    row = {
        "doctype": "Ticket Item",
        "request_type": args.get("request_type"),
        "account_number": args.get("account_number"),
        "cif": args.get("cif"),
        "customer_name": args.get("customer_name"),
        "account_type": args.get("account_type"),
        "email": args.get("email"),
        "contact_number": args.get("contact_number"),
        "attatchment": args.get("attatchment"),
        "new_address": args.get("new_address"),
        "new_contact_number": args.get("new_contact_number"),
        "new_email": args.get("new_email"),
        "new_kyc_no": args.get("new_kyc_no"),
        "new_pan_no": args.get("new_pan_no"),
        "new_name": args.get("new_name"),
        "nomination_opration": args.get("nomination_opration"),
        "existing_branch": args.get("existing_branch"),
        "new_branch": args.get("new_branch"),
        "updated_dob": args.get("updated_dob"),
    }

    doc = frappe.get_doc({
        "doctype": "Sahayog Ticket",
        "dept_name": args.get("department") or "Operations",
        "ticket_type": "Account Service Request",
        "status": "Open",
        "priority": args.get("priority") or "Normal",
        "assigned_to": assigned_to,
        "description": args.get("remarks") or "",
        "due_time": due_time,
        "request_detail": [row],
    })
    if args.get("start_date"):
        doc.set("call_log_date", args.get("start_date"))
    doc.insert(ignore_permissions=False)
    for file_url in args.get("attach_urls") or []:
        try:
            f = frappe.get_doc("File", {"file_url": file_url})
            f.attached_to_doctype = "Sahayog Ticket"
            f.attached_to_name = doc.name
            f.save(ignore_permissions=True)
        except frappe.DoesNotExistError:
            pass
    return {"name": doc.name}


@frappe.whitelist()
def verify_and_close(ticket, remark=""):
    """Branch/Helpdesk: verify + close."""
    return _save_ticket(ticket, {"status": "Closed",
                                 "close_remark": remark or "Verified and closed"})
