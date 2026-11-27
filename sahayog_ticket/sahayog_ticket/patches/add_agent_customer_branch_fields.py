import frappe

SUB_TYPE = "Agent Customer Mapping"

# (field_key, label, field_type, options, reqd)
FIELDS = [
    ("new_branch_code", "New Branch Code", "Link", "Sahayog Branch", 0),
    ("new_branch_name", "New Branch Name", "Data", None, 0),
]

# Keep each request type's fields in the same order as the request layout.
ORDERS = {
    SUB_TYPE: [
        "action_type",
        "new_agent_code",
        "new_agent_name",
        "new_branch_code",
        "new_branch_name",
        "reason",
    ],
    # Existing pair side by side, new pair side by side, then the rest.
    "Agent Authorizer Mapping": [
        "existing_authorizer_id",
        "existing_authorizer_name",
        "new_authorizer_id",
        "new_authorizer_name",
        "effective_date",
        "reason",
    ],
}


def execute():
    for key, label, field_type, options, reqd in FIELDS:
        name = f"{SUB_TYPE}-{key}"
        if frappe.db.exists("Request Field", name):
            doc = frappe.get_doc("Request Field", name)
            changed = False
            if doc.field_type != field_type:
                doc.field_type = field_type
                changed = True
            if (doc.options or None) != (options or None):
                doc.options = options
                changed = True
            if doc.reqd != reqd:
                doc.reqd = reqd
                changed = True
            if not doc.is_active:
                doc.is_active = 1
                changed = True
            if changed:
                doc.save(ignore_permissions=True)
            continue

        frappe.get_doc(
            {
                "doctype": "Request Field",
                "field_key": key,
                "label": label,
                "field_type": field_type,
                "options": options,
                "service_request_sub_type": SUB_TYPE,
                "reqd": reqd,
                "is_active": 1,
            }
        ).insert(ignore_permissions=True)

    for sub_type, order in ORDERS.items():
        for idx, key in enumerate(order, start=1):
            name = f"{sub_type}-{key}"
            if frappe.db.exists("Request Field", name):
                frappe.db.set_value(
                    "Request Field", name, "idx", idx, update_modified=False
                )

    frappe.db.commit()
