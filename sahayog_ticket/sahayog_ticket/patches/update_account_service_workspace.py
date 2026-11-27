"""Point the Account Service Requests workspace to the ASR report page.

Replaces the old "Account Service Requests" Report shortcut with a Page
shortcut to "asr-report" (Account Service Report).
"""

import frappe


def execute():
    if not frappe.db.exists("Workspace", "Account Service Requests"):
        return
    ws = frappe.get_doc("Workspace", "Account Service Requests")
    ws.set("shortcuts", [])
    ws.append("shortcuts", {
        "color": "Grey",
        "label": "Account Service Request",
        "link_to": "asr-report",
        "type": "Page",
    })
    content = frappe.parse_json(ws.content or "[]")
    # Drop any stale Agent shortcut tile before renaming the rest.
    content = [
        block for block in content
        if not (
            block.get("type") == "shortcut"
            and (
                block.get("id") == "Ag3ntR3p0rt01"
                or (block.get("data") or {}).get("shortcut_name") == "Agent Service Request"
            )
        )
    ]
    for block in content:
        if block.get("type") == "shortcut":
            block["data"]["shortcut_name"] = "Account Service Request"
    ws.content = frappe.as_json(content)
    ws.save(ignore_permissions=True)
