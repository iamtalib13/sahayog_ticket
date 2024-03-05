# Copyright (c) 2022, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from datetime import datetime

class SahayogTicket(Document):
    def before_save(self):
        self.set_creation_time()

    def set_creation_time(self):
        creation_date_time = self.creation
        creation_datetime = self.convert_to_datetime(creation_date_time)
        creation_time = self.format_time(creation_datetime)
        self.creation_time = creation_time

    def convert_to_datetime(self, creation_date_time):
        return datetime.strptime(creation_date_time, '%Y-%m-%d %H:%M:%S.%f')

    def format_time(self, creation_datetime):
        return creation_datetime.strftime('%I:%M %p')
