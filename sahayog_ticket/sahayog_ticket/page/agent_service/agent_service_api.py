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
