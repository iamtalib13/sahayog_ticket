"""Point the Account Service Requests workspace to the new ASR report Page.

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
        "label": "Account Service Report",
        "link_to": "asr-report",
        "type": "Page",
    })
    content = frappe.parse_json(ws.content or "[]")
    for block in content:
        if block.get("type") == "shortcut":
            block["data"]["shortcut_name"] = "Account Service Report"
    ws.content = frappe.as_json(content)
    ws.save(ignore_permissions=True)
