"""Grant Comment access to the new ticket workflow roles.

Role swap: Operations Support Executive replaces CPC Loan User,
Employee replaces Branch User for workflow actions. apply_workflow
inserts a Workflow comment on every action, so actors need Comment
create permission (same as the earlier branch/cpc patch).
"""

import frappe

ROLES = ("Operations Support Executive", "Employee")


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
