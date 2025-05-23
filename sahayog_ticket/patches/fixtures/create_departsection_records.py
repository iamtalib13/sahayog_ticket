import frappe

def execute():
    departments = [
        "Stationery",
        "Loan",
        "Admin",
        "HO",
        "Facility",
        "Operations",
        "Accounts",
        "HR",
        "IT"
    ]

    for dept in departments:
        if not frappe.db.exists("Departsection", {"dept_name": dept}):
            frappe.get_doc({
                "doctype": "Departsection",
                "dept_name": dept
            }).insert(ignore_permissions=True)
            print("✅ Departsection records creation patch completed successfully.")
        else:
            print(f"⚠️ Departsection record for {dept} already exists. Skipping creation.")
