import frappe

def sahayog_ticket_permission_condition(user=None):
    if not user:
        user = frappe.session.user

    conditions = [f"`tabSahayog Ticket`.owner = '{user}'"]

    # Get all roles of the user
    user_roles = set(frappe.get_roles(user))

    permitted_roles = []

    for role in user_roles:
        existing_perm = frappe.db.get_value(
            "Custom DocPerm",
            {
                "role": role,
                "parent": "Departsection",
                "permlevel": 0,
            },
            ["name", "read", "select"]
        )

        if existing_perm:
            perm_name, has_read, has_select = existing_perm
            if has_read and has_select:
                # Role already has permission, skip adding
                permitted_roles.append(role)
            else:
                # Permission record exists but missing read/select, update it
                perm_doc = frappe.get_doc("Custom DocPerm", perm_name)
                perm_doc.read = 1
                perm_doc.select = 1
                perm_doc.save(ignore_permissions=True)
                permitted_roles.append(role)
        else:
            # No permission record, create new permission
            perm = frappe.new_doc("Custom DocPerm")
            perm.update({
                "role": role,
                "parent": "Departsection",
                "parenttype": "DocType",
                "permlevel": 0,
                "read": 1,
                "select": 1
            })
            perm.insert(ignore_permissions=True)
            permitted_roles.append(role)

    if permitted_roles:
        allowed_departsections = frappe.get_all(
            "Departsection Role",
            filters={
                "role": ["in", permitted_roles]
            },
            pluck="parent",
            ignore_permissions=True
        )

        if allowed_departsections:
            dept_filter = "', '".join(allowed_departsections)
            conditions.append(f"`tabSahayog Ticket`.dept_name IN ('{dept_filter}')")

    condition_query = " OR ".join(conditions)
    return condition_query
