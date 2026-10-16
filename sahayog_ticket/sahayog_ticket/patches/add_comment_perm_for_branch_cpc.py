"""Grant Comment access to ticket workflow roles.

Workflow actions (apply_workflow -> add_comment) and the ticket chatbot
both insert Comment records. Branch / CPC users had no Comment permission,
so any workflow action failed with:
"does not have doctype access via role permission for document Comment".
"""

import frappe

ROLES = ("Branch User", "CPC Loan User")


def execute():
    for role in ROLES:
        if not frappe.db.exists("Role", role):
            continue
        if frappe.db.exists("Custom DocPerm", {"parent": "Comment", "role": role}):
            continue
        perm = frappe.get_doc(
            {
                "doctype": "Custom DocPerm",
                "parent": "Comment",
                "parenttype": "DocType",
                "parentfield": "permissions",
                "role": role,
                "read": 1,
                "write": 1,
                "create": 1,
            }
        )
        perm.insert(ignore_permissions=True)
