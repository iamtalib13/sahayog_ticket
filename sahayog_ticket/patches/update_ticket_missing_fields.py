import frappe

FIELDS = [
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
]

def is_empty(value):
    value = str(value or "").strip()
    return value in (
        "",
        "None",
        "None None",
        "None None None",
        "null",
        "NULL",
    )

def execute():
    tickets = frappe.get_all("Sahayog Ticket", pluck="name")

    updated = 0
    skipped = 0

    for ticket_name in tickets:
        ticket = frappe.get_doc("Sahayog Ticket", ticket_name)

        updates = {}

        if not ticket.employee_id:
            skipped += 1
            print(f"Skipped {ticket.name} - Employee ID missing")
            continue

        emp = frappe.db.get_value(
            "Employee",
            ticket.employee_id,
            [
                "employee_name",
                "first_name",
                "designation",
                "department",
                "custom_division",
                "sol_id",
                "custom_zone",
                "custom_region",
                "custom_district",
            ],
            as_dict=True,
        )

        if not emp:
            skipped += 1
            print(f"Skipped {ticket.name} - Employee {ticket.employee_id} not found")
            continue

        mapping = {
            "employee_name": emp.employee_name or emp.first_name,
            "designation": emp.designation,
            "emp_department": emp.department,
            "division": emp.custom_division,
            "zone": emp.custom_zone,
            "region": emp.custom_region,
            "district": emp.custom_district,
        }

        for field, value in mapping.items():
            if is_empty(ticket.get(field)) and value:
                updates[field] = value

        # SOL ID
        sol_id = ticket.sol_id

        if is_empty(sol_id) and emp.sol_id:
            sol_id = emp.sol_id
            updates["sol_id"] = sol_id

        # Branch & State
        if sol_id:
            branch = frappe.db.get_value(
                "Sahayog Branch",
                {"sol_id": sol_id},
                ["branch", "state"],
                as_dict=True,
            )

            if branch:
                if is_empty(ticket.branch) and branch.branch:
                    updates["branch"] = branch.branch

                if is_empty(ticket.state) and branch.state:
                    updates["state"] = branch.state

        if updates:
            frappe.db.set_value(
                "Sahayog Ticket",
                ticket.name,
                updates,
                update_modified=False,
            )
            updated += 1
            print(f"Updated: {ticket.name}")

    frappe.db.commit()

    print("\n" + "=" * 60)
    print(f"Total Tickets : {len(tickets)}")
    print(f"Updated       : {updated}")
    print(f"Skipped       : {skipped}")
    print("=" * 60)
