import frappe

def execute():
    roles = [
        "IT Support Executive",
        "IT Support Manager",
        "Admin Support Executive",
        "Admin Support Manager",
        "Stationery Store & Support Manager",
        "Operations Support Executive",
        "Operations Support Manager",
        "HR Support Executive",
        "HR Support Manager",
        "Accounts Support Executive",
        "Accounts Support Manager",
        "HO Support Executive",
        "HO Support Manager",
        "Facility Support Executive",
        "Facility Support Manager",
        "Loan Support Executive",
        "Loan Support Manager"
    ]

    print("✅Sahayog Ticket Roles creation patch Started.")
    for role_name in roles:
        if not frappe.db.exists("Role", role_name):
            frappe.get_doc({
                "doctype": "Role",
                "role_name": role_name
            }).insert(ignore_permissions=True)
            print(f"Created Role: {role_name}")
        else:
            print(f"Role already exists: {role_name}")

    print("✅ Roles creation patch completed successfully.")
