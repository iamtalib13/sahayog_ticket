import json as _json
import frappe
from frappe import _


AGENT_TICKET_TYPE = "Agent Service Request"


@frappe.whitelist()
def get_sub_types():
    """Active request types for Agent Service Request."""
    return frappe.get_all(
        "Service Request Sub Type",
        filters={"ticket_type": AGENT_TICKET_TYPE, "is_active": 1},
        fields=["name", "sub_type_name"],
        order_by="name asc",
    )


@frappe.whitelist()
def get_fields(sub_type):
    """Active field definitions for a request type."""
    if not sub_type:
        return []
    return frappe.get_all(
        "Request Field",
        filters={"service_request_sub_type": sub_type, "is_active": 1},
        fields=[
            "name", "field_key", "label", "field_type", "options", "reqd",
        ],
        order_by="idx asc, name asc",
    )


@frappe.whitelist()
def get_agents():
    """Agent codes/names for the portal autocomplete."""
    return frappe.get_all(
        "Agent",
        fields=["name as code", "agent_name"],
        filters={"agent_name": ("is", "set")},
        order_by="agent_name asc",
        limit_page_length=0,
    )


@frappe.whitelist()
def get_agent_details(agent_code):
    """Fetch agent name and existing branch/SOL from Agent master."""
    if not agent_code:
        return {}
    try:
        d = frappe.get_doc("Agent", agent_code)
    except frappe.DoesNotExistError:
        return {}
    return {
        "agent_name": d.get("agent_name") or "",
        "branch": d.get("branch_name") or "",
        "sol_id": d.get("sol_id") or "",
    }


@frappe.whitelist()
def create_agent_request(args):
    """Create Agent Service Request with dynamic field values.

    args: {agent_code, agent_name, sub_type, values, remarks, priority, attach_urls}
    """
    if isinstance(args, str):
        args = _json.loads(args or "{}")
    args = dict(args or {})

    agent_code = args.get("agent_code")
    sub_type = args.get("sub_type")
    if not agent_code:
        frappe.throw(_("Agent Code is required."))
    if not sub_type:
        frappe.throw(_("Request Type is required."))

    values = args.get("values") or {}
    if isinstance(values, str):
        values = _json.loads(values or "{}")

    # validate mandatory fields from master
    for f in get_fields(sub_type):
        if f.get("reqd") and str(values.get(f["field_key"]) or "").strip() == "":
            frappe.throw(_("{0} is required.").format(f.get("label") or f["field_key"]))

    agent = get_agent_details(agent_code)
    agent_name = args.get("agent_name") or agent.get("agent_name") or ""
    item_key = frappe.generate_hash(length=12)

    row = {
        "doctype": "Ticket Item",
        "sub_type": sub_type,
        "agent_code": agent_code,
        "agent_name": agent_name,
        "item_key": item_key,
    }

    # Build typed value rows before insert so the ticket's server-side
    # validation sees them (previously they were inserted afterwards).
    field_defs = get_fields(sub_type)
    field_types = {f["field_key"]: f["field_type"] for f in field_defs}
    value_rows = []
    for key, raw in values.items():
        if key not in field_types:
            continue
        ft = field_types[key]
        vals = {
            "doctype": "Ticket Item Value",
            "item_key": item_key,
            "field_key": key,
            "value_data": None,
            "value_text": None,
            "value_date": None,
            "value_display": str(raw) if raw is not None else "",
        }
        if ft == "Small Text":
            vals["value_text"] = raw
        elif ft == "Date":
            vals["value_date"] = raw or None
        else:  # Data, Select
            vals["value_data"] = raw
        value_rows.append(vals)

    ticket = frappe.get_doc({
        "doctype": "Sahayog Ticket",
        "dept_name": "Operations",
        "ticket_type": AGENT_TICKET_TYPE,
        "status": "Open",
        "priority": args.get("priority") or "Normal",
        "description": args.get("remarks") or "",
        "request_detail": [row],
        "request_values": value_rows,
    })
    # request_type/account_number are conditional for account rows; agent
    # rows use sub_type + dynamic values. Dynamic mandatory fields are
    # validated server-side by SahayogTicket.validate_agent_row_values().
    # Do not skip mandatory checks: only dept_name/ticket_type are reqd on
    # the parent and both are set above.
    ticket.insert(ignore_permissions=False)

    for file_url in args.get("attach_urls") or []:
        try:
            f = frappe.get_doc("File", {"file_url": file_url})
            f.attached_to_doctype = "Sahayog Ticket"
            f.attached_to_name = ticket.name
            f.save(ignore_permissions=True)
        except frappe.DoesNotExistError:
            pass

    return {"name": ticket.name}


# ---------------------------------------------------------------------------
# Backend parity (account-service-equivalent) for Agent Service Requests
# ---------------------------------------------------------------------------

import frappe
from frappe import _

AGENT_SERVICE_TYPES = [r["name"] for r in frappe.get_all(
    "Service Request Sub Type",
    filters={"ticket_type": AGENT_TICKET_TYPE, "is_active": 1},
    fields=["name"], order_by="name asc",
)]


def _my_role():
    roles = set(frappe.get_roles(frappe.session.user))
    if "Contact Service" in roles or "Helpdesk Contact" in roles or frappe.session.user == "Administrator":
        return "helpdesk"
    if "CPC Loan User" in roles or "Operations Support Executive" in roles:
        return "cpc"
    return "branch"


def _tat_breached(total_days, tat):
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
    where = ["st.ticket_type = %(tt)s"]
    vals = {"tt": AGENT_TICKET_TYPE}
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
            (SELECT ti.sub_type FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS sub_type,
            (SELECT ti.agent_code FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS agent_code,
            (SELECT ti.agent_name FROM `tabTicket Item` ti
              WHERE ti.parent = st.name LIMIT 1) AS agent_name,
            (SELECT tsl.status_change_by FROM `tabTicket Status Log` tsl
              WHERE tsl.parent = st.name ORDER BY tsl.status_change_on DESC LIMIT 1) AS last_action_by,
            (SELECT tsl.status_change_on FROM `tabTicket Status Log` tsl
              WHERE tsl.parent = st.name ORDER BY tsl.status_change_on DESC LIMIT 1) AS last_action_on
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
        turn, turn_label = _turn_for(r)
        d["turn"] = turn
        d["turn_label"] = turn_label
        out.append(d)
    return out


def _turn_for(t):
    status = t.get("status")
    if status == "Closed":
        return ("done", "Done")
    if status == "Resolved":
        return ("branch", "Branch User")
    if not t.get("assigned_to"):
        return ("helpdesk", "Contact Service")
    if t.get("response_pending") == "Pending Branch":
        return ("branch", "Branch User")
    return ("cpc", "CPC User")


def _step_for(t):
    status = t.get("status")
    if status == "Closed":
        return 5
    if status == "Resolved":
        return 4
    if status in ("In-Progress",):
        return 3
    if t.get("assigned_to"):
        return 2
    return 1


def _count(where, vals):
    return frappe.db.sql(
        f"SELECT COUNT(*) FROM `tabSahayog Ticket` st WHERE {where}",
        vals,
    )[0][0]


@frappe.whitelist()
def get_dashboard_data(view="all", tab="all", sub_type=None, agent_code=None,
                       department=None, assigned_to_me=0, q_id=None,
                       q_agent=None, q_agent_code=None, status_exact=None, rp=None):
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

    list_where, list_vals = scope, dict(vals)

    if department:
        list_where += " AND st.dept_name = %(f_dept)s"
        list_vals["f_dept"] = department
    if sub_type:
        list_where += """ AND EXISTS (
            SELECT 1 FROM `tabTicket Item` ti
            WHERE ti.parent = st.name AND ti.sub_type = %(f_stype)s)"""
        list_vals["f_stype"] = sub_type
    if agent_code:
        pass
    if assigned_to_me and str(assigned_to_me) not in ("0", "false", "False"):
        list_where += f" AND st.assigned_to = {u}"
    if q_id:
        list_where += " AND st.name LIKE %(q_id)s"
        list_vals["q_id"] = f"%{q_id}%"
    if q_agent:
        list_where += " AND (st.employee_name LIKE %(q_ag)s OR EXISTS (" \
            "SELECT 1 FROM `tabTicket Item` ti WHERE ti.parent = st.name " \
            "AND ti.agent_name LIKE %(q_ag)s))"
        list_vals["q_ag"] = f"%{q_agent}%"
    if q_agent_code:
        list_where += " AND EXISTS (SELECT 1 FROM `tabTicket Item` ti " \
            "WHERE ti.parent = st.name AND ti.agent_code LIKE %(q_ac)s)"
        list_vals["q_ac"] = f"%{q_agent_code}%"

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
            pass
        elif role == "cpc":
            list_where = _ticket_base_query(f"st.assigned_to = {u}")[0]
            list_vals = {"tt": AGENT_TICKET_TYPE}
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
        "service_types": AGENT_SERVICE_TYPES,
        "agents": _agents_in_scope(scope, vals),
    }

    return {"role": role, "counters": counters, "tickets": tickets,
            "total": total, "tabs": tabs, "options": options}


def _strip_tab(where):
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
    if doc.ticket_type != AGENT_TICKET_TYPE:
        frappe.throw("Only Agent Service Request tickets are allowed here.")
    for k, v in updates.items():
        doc.set(k, v)
    doc.save(ignore_permissions=False)
    return {"name": doc.name, "status": doc.status,
            "response_pending": doc.response_pending}


@frappe.whitelist()
def take_and_start(ticket):
    me = frappe.session.user
    if _my_role() == "branch":
        frappe.throw("Only CPC / Helpdesk can take tickets.")
    return _save_ticket(ticket, {"assigned_to": me, "status": "In-Progress"})


@frappe.whitelist()
def assign_ticket(ticket, user):
    if _my_role() not in ("helpdesk", "cpc"):
        frappe.throw("Only Helpdesk / CPC can assign.")
    return _save_ticket(ticket, {"assigned_to": user})


@frappe.whitelist()
def need_branch_info(ticket, remark=""):
    if _my_role() not in ("cpc", "helpdesk"):
        frappe.throw("Only CPC / Helpdesk can ask branch.")
    return _save_ticket(ticket, {"response_pending": "Pending Branch",
                                 "executive_remark": remark or "Info needed from branch"})


@frappe.whitelist()
def submit_branch_info(ticket):
    return _save_ticket(ticket, {"response_pending": "Pending Operations"})


@frappe.whitelist()
def mark_resolved(ticket, remark):
    if not remark:
        frappe.throw("Resolution remark is required.")
    if _my_role() not in ("cpc", "helpdesk"):
        frappe.throw("Only CPC / Helpdesk can resolve.")
    return _save_ticket(ticket, {"status": "Resolved", "response_pending": "Resolved",
                                 "resolved_remark": remark})


@frappe.whitelist()
def list_cpc_users():
    rows = frappe.db.sql(
        """
        SELECT DISTINCT u.name, u.full_name
        FROM tabUser u
        INNER JOIN `tabHas Role` hr ON hr.parent = u.name AND hr.parenttype = 'User'
        WHERE hr.role IN ('CPC Loan User', 'Operations Support Executive') AND u.enabled = 1 AND u.name NOT IN ('Guest', 'Administrator')
        ORDER BY u.full_name
        """
    )
    return [{"email": r[0], "name": r[1] or r[0]} for r in rows]


@frappe.whitelist()
def verify_and_close(ticket, remark=""):
    return _save_ticket(ticket, {"status": "Closed",
                                 "close_remark": remark or "Verified and closed"})
