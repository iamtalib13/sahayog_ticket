import frappe

def execute():
    # Fetch all tickets that have an employee_id
    tickets = frappe.get_all(
        "Sahayog Ticket",
        fields=["name", "employee_id", "branch", "district", "sol_id"]
    )

    print(f"Starting patch to update geographic info for {len(tickets)} tickets...")
    
    updated_count = 0
    for ticket in tickets:
        if not ticket.employee_id:
            continue
            
        # Check if any of the target fields are missing
        if not ticket.branch or not ticket.district or not ticket.sol_id:
            # Fetch details from Employee record
            emp_info = frappe.db.get_value(
                "Employee", 
                ticket.employee_id, 
                ["branch", "custom_district", "sol_id"], 
                as_dict=True
            )

            if emp_info:
                update_values = {}
                # Set values only if they are currently empty
                if not ticket.branch and emp_info.branch:
                    update_values["branch"] = emp_info.branch
                if not ticket.district and emp_info.custom_district:
                    update_values["district"] = emp_info.custom_district
                if not ticket.sol_id and emp_info.sol_id:
                    update_values["sol_id"] = emp_info.sol_id

                if update_values:
                    # Update without changing modified date for history integrity
                    frappe.db.set_value("Sahayog Ticket", ticket.name, update_values, update_modified=False)
                    updated_count += 1

    print(f"Patch completed successfully. Total tickets updated: {updated_count}")
