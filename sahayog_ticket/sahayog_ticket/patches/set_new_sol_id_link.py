import frappe


def execute():
    """Link New SOL ID to Sahayog Branch and fix the field order."""
    name = "Agent SOL ID Modification-new_sol_id"
    if frappe.db.exists("Request Field", name):
        doc = frappe.get_doc("Request Field", name)
        if doc.field_type != "Link" or doc.options != "Sahayog Branch":
            doc.db_set("field_type", "Link", update_modified=False)
            doc.db_set("options", "Sahayog Branch", update_modified=False)

    # Request Field rows created by older versions have idx = 0, so the
    # form sorts them by name (New Branch before New SOL ID). Set explicit idx.
    order = ["existing_sol_id", "existing_branch", "new_sol_id", "new_branch", "reason"]
    idx = 0
    for key in order:
        field_name = f"Agent SOL ID Modification-{key}"
        if not frappe.db.exists("Request Field", field_name):
            continue
        idx += 1
        frappe.db.set_value("Request Field", field_name, "idx", idx, update_modified=False)
