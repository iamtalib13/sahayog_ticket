import frappe

def execute():
    print("🔁 Starting to map roles to Departsection...")

    # Define the mapping of departsection to its relevant roles
    department_role_map = {
        "IT": ["IT Support Executive", "IT Support Manager"],
        "Admin": ["Admin Support Executive", "Admin Support Manager"],
        "Stationery": ["Stationery Store & Support Manager"],
        "Operations": ["Operations Support Executive", "Operations Support Manager"],
        "HR": ["HR Support Executive", "HR Support Manager"],
        "Accounts": ["Accounts Support Executive", "Accounts Support Manager"],
        "HO": ["HO Support Executive", "HO Support Manager"],
        "Facility": ["Facility Support Executive", "Facility Support Manager"],
        "Loan": ["Loan Support Executive", "Loan Support Manager"]
    }

    for dept_name, roles in department_role_map.items():
        depart_doc = frappe.get_doc("Departsection", {"dept_name": dept_name})

        existing_roles = [d.role for d in depart_doc.get("department_roles") or []]

        new_roles_added = False
        for role in roles:
            if role not in existing_roles:
                depart_doc.append("department_roles", {"role": role})
                print(f"✔️ Mapped new role '{role}' to department '{dept_name}'")
                new_roles_added = True
            else:
                print(f"ℹ️ Role '{role}' already mapped to department '{dept_name}', skipping")

        if new_roles_added:
            depart_doc.save(ignore_permissions=True)
            print(f"✅ Saved updated mapping for department '{dept_name}'")
        else:
            print(f"✅ No changes needed for department '{dept_name}'")

    print("🎉 Role mapping to Departsection completed successfully.")
