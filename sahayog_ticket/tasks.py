import frappe
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import datetime


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
import datetime
import frappe
from frappe.utils import date_diff, nowdate, getdate
import frappe
from frappe.utils import now, getdate, date_diff

def update_tat_age():
    try:
        # Get the current date
        current_date = getdate(now())

        # Fetch all Sahayog Ticket records where status is not "Closed" or "Cancelled"
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
            creation_datetime = getdate(ticket.creation)
            creation_date = creation_datetime.strftime("%Y-%m-%d")  # Format YYYY-MM-DD
            creation_time = creation_datetime.strftime("%I:%M %p")  # Format HH:MM AM/PM

            # Calculate the total days since creation using date_diff
            total_days = date_diff(current_date, creation_datetime)

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
