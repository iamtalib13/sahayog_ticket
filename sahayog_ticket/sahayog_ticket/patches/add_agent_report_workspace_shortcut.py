import frappe


ACCOUNT_WORKSPACE = "Account Service Requests"
OPERATION_WORKSPACE = "Operation Tickets"
AGENT_WORKSPACE = "Agent Service Request"
LABEL = "Agent Service Request"
URL = "/app/asr-report?ticket_type=Agent%20Service%20Request"


def _remove_agent_tile_from_account():
    if not frappe.db.exists("Workspace", ACCOUNT_WORKSPACE):
        return
    ws = frappe.get_doc("Workspace", ACCOUNT_WORKSPACE)
    changed = False
    if any((s.label or "").strip() == LABEL or (s.url or "") == URL for s in (ws.shortcuts or [])):
        ws.shortcuts = [
            s for s in ws.shortcuts
            if (s.label or "").strip() != LABEL and (s.url or "") != URL
        ]
        changed = True
    content = frappe.parse_json(ws.content or "[]")
    filtered = [
        block for block in content
        if not (
            block.get("type") == "shortcut"
            and (
                block.get("id") == "Ag3ntR3p0rt01"
                or (block.get("data") or {}).get("shortcut_name") == LABEL
            )
        )
    ]
    if len(filtered) != len(content):
        ws.content = frappe.as_json(filtered)
        changed = True
    if changed:
        ws.save(ignore_permissions=True)


def _ensure_agent_workspace():
    parent_title = frappe.db.get_value("Workspace", OPERATION_WORKSPACE, "title") or OPERATION_WORKSPACE
    if frappe.db.exists("Workspace", AGENT_WORKSPACE):
        ws = frappe.get_doc("Workspace", AGENT_WORKSPACE)
    else:
        ws = frappe.new_doc("Workspace")
    ws.update({
        "label": AGENT_WORKSPACE,
        "title": AGENT_WORKSPACE,
        "parent_page": parent_title,
        "module": "Sahayog Ticket",
        "public": 1,
        "is_hidden": 0,
        "icon": "solid-success",
        "sequence_id": 17.0,
        "links": [],
        "roles": [],
    })
    if not any((s.label or "").strip() == LABEL for s in (ws.shortcuts or [])):
        ws.append("shortcuts", {
            "color": "Grey",
            "label": LABEL,
            "link_to": "",
            "type": "URL",
            "url": URL,
        })
    content = frappe.parse_json(ws.content or "[]")
    if not content:
        content = [{
            "id": "AgWsHdr001",
            "type": "header",
            "data": {"text": f'<span class="h4">{LABEL}</span>', "col": 12},
        }]
    if not any(
        block.get("type") == "shortcut"
        and (block.get("data") or {}).get("shortcut_name") == LABEL
        for block in content
    ):
        content.append({
            "id": "Ag3ntR3p0rt01",
            "type": "shortcut",
            "data": {"shortcut_name": LABEL, "col": 3},
        })
    ws.content = frappe.as_json(content)
    if ws.is_new():
        ws.insert(ignore_permissions=True)
    else:
        ws.save(ignore_permissions=True)


def execute():
    """Keep Agent report out of Account workspace and add it under Operation Tickets."""
    _remove_agent_tile_from_account()
    _ensure_agent_workspace()
