import frappe


def execute():
    tickets = frappe.get_all(
        "Sahayog Ticket",
        fields=[
            "name",
            "employee_id",
            "employee_name",
            "designation",
            "emp_department",
            "division",
            "branch",
            "sol_id",
            "zone",
            "region",
            "district",
            "state",
        ],
    )

    print(f"Total Tickets: {len(tickets)}")

    updated = 0
    skipped = 0

    for ticket in tickets:
        if not ticket.employee_id:
            skipped += 1
            continue

        emp = frappe.db.get_value(
            "Employee",
            ticket.employee_id,
            [
                "employee_name",
                "designation",
                "department",
                "custom_division",
                "branch",
                "sahayog_branch",
                "custom_zone",
                "custom_region",
                "custom_district",
            ],
            as_dict=True,
        )

        if not emp:
            skipped += 1
            continue

        updates = {}

        field_map = {
            "employee_name": emp.employee_name,
            "designation": emp.designation,
            "emp_department": emp.department,
            "division": emp.custom_division,
            "sol_id": emp.sahayog_branch,
            "zone": emp.custom_zone,
            "region": emp.custom_region,
            "district": emp.custom_district,
        }

        for field, value in field_map.items():
            if not ticket.get(field) and value:
                updates[field] = value

        if emp.sahayog_branch:
            branch = frappe.db.get_value(
                "Sahayog Branch",
                {"sol_id": emp.sahayog_branch},
                ["branch", "state"],
                as_dict=True,
            )

            if branch:
                if not ticket.get("branch") and branch.branch:
                    updates["branch"] = branch.branch

                if not ticket.get("state") and branch.state:
                    updates["state"] = branch.state

        if updates:
            frappe.db.set_value(
                "Sahayog Ticket",
                ticket.name,
                updates,
                update_modified=False,
            )
            updated += 1
            print(f"Updated Ticket: {ticket.name} -> {list(updates.keys())}")
        else:
            skipped += 1

    frappe.db.commit()

    print("=" * 60)
    print(f"Tickets Updated  : {updated}")
    print(f"Skipped          : {skipped}")
    print("Done.")
