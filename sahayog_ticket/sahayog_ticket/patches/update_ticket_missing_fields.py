import frappe


def execute():
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

    # -----------------------------
    # Counters
    # -----------------------------
    total_tickets = 0
    tickets_with_missing = 0
    tickets_fixed = 0
    nothing_to_update = 0
    employee_not_found = 0
    missing_employee_id = 0
    missing_sol_id = 0
    branch_not_found = 0
    state_not_available = 0

    print("Fetching Sahayog Tickets...")

    tickets = frappe.get_all(
        "Sahayog Ticket",
        fields=["name", "employee_id"]
    )

    total_tickets = len(tickets)

    print(f"Total Tickets : {total_tickets}")
    print("-" * 60)

    for idx, row in enumerate(tickets, start=1):

        # Progress
        if idx % 500 == 0:
            print(f"Processed {idx}/{total_tickets}")

        ticket = frappe.get_doc("Sahayog Ticket", row.name)

        # Skip if all fields are already filled
        if not any(not ticket.get(f) for f in FIELDS):
            nothing_to_update += 1
            continue

        tickets_with_missing += 1

        # ----------------------------------
        # Employee ID Check
        # ----------------------------------
        if not ticket.employee_id:
            missing_employee_id += 1
            continue

        # ----------------------------------
        # Employee Details
        # ----------------------------------
        emp = frappe.db.get_value(
            "Employee",
            ticket.employee_id,
            [
                "employee_name",
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
            employee_not_found += 1
            continue

        updates = {}

        # ----------------------------------
        # Employee Fields
        # ----------------------------------
        mapping = {
            "employee_name": emp.employee_name,
            "designation": emp.designation,
            "emp_department": emp.department,
            "division": emp.custom_division,
            "zone": emp.custom_zone,
            "region": emp.custom_region,
            "district": emp.custom_district,
        }

        for field, value in mapping.items():
            if not ticket.get(field) and value:
                updates[field] = value

        # ----------------------------------
        # SOL ID
        # ----------------------------------
        sol_id = ticket.sol_id

        if not sol_id:

            if emp.sol_id:
                sol_id = emp.sol_id
                updates["sol_id"] = sol_id
            else:
                missing_sol_id += 1

        # ----------------------------------
        # Branch & State
        # ----------------------------------
        if sol_id:

            branch = frappe.db.get_value(
                "Sahayog Branch",
                {"sol_id": sol_id},
                ["branch", "state"],
                as_dict=True,
            )

            if branch:

                if not ticket.get("branch") and branch.branch:
                    updates["branch"] = branch.branch

                if not ticket.get("state"):

                    if branch.state:
                        updates["state"] = branch.state
                    else:
                        state_not_available += 1

            else:
                branch_not_found += 1

        # ----------------------------------
        # Save
        # ----------------------------------
        if updates:

            frappe.db.set_value(
                "Sahayog Ticket",
                ticket.name,
                updates,
                update_modified=False,
            )

            tickets_fixed += 1

    frappe.db.commit()

    print("\n")
    print("=" * 65)
    print("           SAHAYOG TICKET DATA FIX SUMMARY")
    print("=" * 65)
    print(f"Total Tickets                     : {total_tickets}")
    print(f"Tickets With Missing Fields        : {tickets_with_missing}")
    print(f"Successfully Fixed                : {tickets_fixed}")
    print(f"Already Complete                  : {nothing_to_update}")
    print(f"Missing Employee ID               : {missing_employee_id}")
    print(f"Employee Not Found                : {employee_not_found}")
    print(f"Employee Missing SOL ID           : {missing_sol_id}")
    print(f"Sahayog Branch Not Found          : {branch_not_found}")
    print(f"State Not Available               : {state_not_available}")
    print("=" * 65)
    print("Completed Successfully.")

# This is a patch to fix the branch fields in ticket
