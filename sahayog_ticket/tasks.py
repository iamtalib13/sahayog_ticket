import frappe
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import datetime
from frappe.utils import nowdate, date_diff



# def send_email():
#     ob = smtplib.SMTP("smtp.office365.com", 587)
#     ob.starttls()
#     ob.login("talib.s@sahayogmultistate.com", "Ts9422817246")
#     subject = "Sending from Python"
#     body = "hello"
#     message = "Subject:{}\n\n{}".format(subject, body)
#     listOfAddress = ["talibsh16@gmail.com"]
#     ob.sendmail("talib.s@sahayogmultistate.com", listOfAddress, message)
#     print("Email sent successfully.")
#     ob.quit()
import frappe
from frappe.utils import get_datetime, now, date_diff

def update_tat_age():
    try:
        # Get the current datetime
        current_datetime = get_datetime(now())
        
        # Fetch all Sahayog Ticket records where status is not "Closed", "Cancelled", or "Resolved"
        tickets = frappe.get_all(
            "Sahayog Ticket",
            filters={"status": ["not in", ["Closed", "Cancelled", "Resolved"]]},
            fields=[
                "name",
                "creation",
                "status",
                "dept_name",
                "ticket_type",
                "emp_first_name",
                "emp_last_name",
            ],
        )

        # Initialize a counter for updated records
        updated_records_count = 0

        for ticket in tickets:
            ticket_id = ticket.name
            
            # Convert creation datetime string to datetime object
            creation_datetime = get_datetime(ticket.creation)
            
            # Format creation date and time
            creation_date = creation_datetime.strftime("%Y-%m-%d")  # Format YYYY-MM-DD
            creation_time = creation_datetime.strftime("%I:%M %p")  # Format HH:MM AM/PM

            # Debug print statements to verify the raw and formatted values
            print(f"Raw Creation Datetime: {ticket.creation}")
            print(f"Parsed Creation Datetime: {creation_datetime}")
            print(f"Formatted Creation Date: {creation_date}")
            print(f"Formatted Creation Time: {creation_time}")

            # Calculate the total days since creation using date_diff
            total_days = date_diff(current_datetime, creation_datetime)

            # Concatenate first_name and last_name
            employee_name = f"{ticket.emp_first_name} {ticket.emp_last_name}"

            # Update fields in the document
            frappe.db.set_value(
                "Sahayog Ticket", ticket_id, "total_days", total_days, update_modified=False
            )
            
            frappe.db.set_value(
                "Sahayog Ticket",
                ticket_id,
                "employee_name",
                employee_name,
                update_modified=False,
            )
            
            frappe.db.set_value(
                "Sahayog Ticket", ticket_id, "creation_time", creation_time, update_modified=False
            )

            # Increment the counter
            updated_records_count += 1

            # Print the updated values
            print(f"Ticket ID: {ticket_id}")
            print(f"Creation Date: {creation_date}")
            print(f"Creation Time: {creation_time}")
            print(f"Total Days: {total_days}")
            print(f"Employee Name: {employee_name}")

        # Commit the transaction to the database
        frappe.db.commit()

        # Log the number of records updated
        frappe.log(f"Updated total days and employee names for {updated_records_count} records")

    except Exception as e:
        # Handle any exceptions and log an error message
        frappe.log_error(f"Error in update_tat_age: {e}", "Update TAT Age Error")

import datetime

def print_creation_time():
    try:
        # Fetch all Sahayog Ticket records where status is not "Closed" or "Cancelled"
        tickets = frappe.get_all(
            "Sahayog Ticket",
            filters={"status": ["not in", ["Closed", "Cancelled"]]},
            fields=["name", "creation"]
        )

        for ticket in tickets:
            ticket_id = ticket.name
            creation_datetime = ticket.creation
            creation_time = creation_datetime.strftime("%I:%M %p")  # Format HH:MM AM/PM

            print(f"Creation Time for ticket {ticket_id}: {creation_time}")

    except Exception as e:
        # Handle any exceptions and print an error message
        print(f"Error: {e}")

def calculate_grievance_ticket_age():
    # Fetch all documents from the "Grievances and Redressal" doctype
    grievances = frappe.get_all('Grievances and Redressal', fields=['name', 'date', 'level_1_tat', 'level_2_tat'])
    
    for grievance in grievances:
        # Fetch the full document
        doc = frappe.get_doc('Grievances and Redressal', grievance.name)
        
        # Calculate the age of the ticket in days
        ticket_age = date_diff(nowdate(), doc.date)
        
        # Convert TAT levels to integers if they are not None
        level_1_tat = int(doc.level_1_tat or 5)
        level_2_tat = int(doc.level_2_tat or 8)
        
        # Determine the tat_result based on ticket_age
        if ticket_age == level_1_tat :
            tat_result = '1'
        elif level_1_tat < ticket_age < level_2_tat:
            tat_result = '2'
        elif ticket_age >= level_2_tat:
            tat_result = '3'
        else:
           tat_result = '0'  # Ensure tat_result is defined
        
        # Update the ticket_age and tat_result fields without updating the modified timestamp
        frappe.db.set_value('Grievances and Redressal', grievance.name, {
            'ticket_age': ticket_age,
            'tat_result': tat_result
        }, update_modified=False)