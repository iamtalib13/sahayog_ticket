import frappe

def execute():
    # Identify only those Custom DocPerms that were created/modified for Departsection
    perms = frappe.get_all(
        "Custom DocPerm",
        filters={
            "parent": "Departsection",
            "permlevel": 0,
            "read": 1,
            "select": 1
        },
        fields=["name", "role"]
    )

    if not perms:
        print("No Custom DocPerms to rollback for Departsection.")
        return

    for perm in perms:
        try:
            frappe.delete_doc("Custom DocPerm", perm.name, force=True)
            print(f"✅ Deleted Custom DocPerm: {perm.name} (Role: {perm.role})")
        except Exception as e:
            print(f"❌ Failed to delete Custom DocPerm: {perm.name} — {str(e)}")
