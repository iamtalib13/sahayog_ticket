# -*- coding: utf-8 -*-
# Copyright (c) 2025, Your Company
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe

def get_permission_query_conditions(user):
    if not user or user == "Administrator":
        return ""

    # Get all roles of the user
    roles = frappe.get_roles(user)

    # Get all departments mapped to user's roles via 'Departsection Role'
    departments = frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", roles]},
        pluck="parent"
    )

    # Always allow user to see their own tickets
    conditions = [f"`tabSahayog Ticket`.owner = {frappe.db.escape(user)}"]

    if departments:
        # Escape and format departments list for SQL
        escaped_departments = [frappe.db.escape(dept) for dept in departments]
        dept_list = ", ".join(f"'{dept}'" for dept in escaped_departments)
        conditions.append(f"`tabSahayog Ticket`.dept_name IN ({dept_list})")

    return " OR ".join(conditions)

def has_permission(doc, ptype, user):
    if user == "Administrator":
        return True

    # Always allow user to access their own documents
    if doc.owner == user:
        return True

    # Get all roles of the user
    roles = frappe.get_roles(user)

    # Get all departments mapped to user's roles
    departments = frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", roles]},
        pluck="parent"
    )

    # Allow if document's dept_name matches one of user's departments
    return doc.get("dept_name") in departments
