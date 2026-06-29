# Copyright (c) 2025, Talib Sheikh and contributors
# For license information, please see license.txt

import re
import frappe
from frappe.model.document import Document

class TicketItem(Document):
	def validate(self):
		if self.account_number:
			if not re.match(r"^\d{15}$", str(self.account_number)):
				frappe.throw(
					frappe._("Account Number must be a valid 15-digit number")
				)
		if self.contact_number:
			contact_number = str(self.contact_number)
			if contact_number.startswith("+91"):
				contact_number = contact_number[3:]
			if not re.match(r"^[6-9]\d{9}$", contact_number):
				frappe.throw(
					frappe._("Contact Number must be a valid 10-digit Indian Mobile Number")
				)
