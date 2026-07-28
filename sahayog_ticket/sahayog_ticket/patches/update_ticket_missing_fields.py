import frappe


def execute():
    tickets = frappe.get_all(
        "Sahayog Ticket",
        fields=[
            "name", "employee_id", "assigned_to",
            "employee_name", "designation", "emp_department", "division",
            "branch", "sol_id", "zone", "region", "district", "state",
            "assigned_to_name",
        ],
    )

    print(f"Starting patch: {len(tickets)} tickets to check...")

    updated = 0
    for ticket in tickets:
        updates = {}

        # --- Employee fields (10) ---
        if ticket.employee_id:
            emp = frappe.db.get_value(
                "Employee",
                ticket.employee_id,
                [
                    "employee_name", "designation", "department", "custom_division",
                    "branch", "sol_id", "custom_zone", "custom_region", "custom_district",
                ],
                as_dict=True,
            )
            if emp:
                field_map = {
                    "employee_name": emp.employee_name,
                    "designation": emp.designation,
                    "emp_department": emp.department,
                    "division": emp.custom_division,
                    "branch": emp.branch,
                    "sol_id": emp.sol_id,
                    "zone": emp.custom_zone,
                    "region": emp.custom_region,
                    "district": emp.custom_district,
                }
                for field, value in field_map.items():
                    if not ticket.get(field) and value:
                        updates[field] = value

                # state from Sahayog Branch via sol_id
                if not ticket.get("state") and emp.sol_id:
                    state = frappe.db.get_value(
                        "Sahayog Branch", {"sol_id": emp.sol_id}, "state"
                    )
                    if state:
                        updates["state"] = state

        # --- assigned_to_name (1) ---
        if ticket.assigned_to and not ticket.get("assigned_to_name"):
            full_name = frappe.db.get_value("User", ticket.assigned_to, "full_name")
            if full_name:
                updates["assigned_to_name"] = full_name

        if updates:
            frappe.db.set_value(
                "Sahayog Ticket", ticket.name, updates, update_modified=False
            )
            updated += 1

    print(f"Patch completed. Updated: {updated} tickets")
